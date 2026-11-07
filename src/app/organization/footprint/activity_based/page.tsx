"use client";

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./components/MeetingForm";
import TravelForm, { TravelData } from "./components/TravelForm";
import ResourceForm, { ResourceData } from "./components/ResourceForm";
import CalculationResult from "./components/CalculationResult";
import { executeCarbonCalculation } from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";
import { Sparkles, Calculator } from "lucide-react";

export default function ActivityBasedFootprintPage() {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);
  const [resources, setResources] = useState<ResourceData[]>([]);

  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  const [isCalculated, setIsCalculated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [meetingRes, setMeetingRes] = useState<number>(0);
  const [travelRes, setTravelRes] = useState<number>(0);
  const [resourceRes, setResourceRes] = useState<number>(0);

  // ดึงข้อมูล Master Data และ Emission Factor
  useEffect(() => {
    async function fetchMasterData() {
      try {
        const { data: actData, error: actError } = await supabase.from('activity_based').select('*');
        if (actError) throw actError;

        const { data: efData, error: efError } = await supabase.from('emission_factor').select('*');
        if (efError) throw efError;

        if (actData) {
          const formatted = actData.map((item: any) => {
            const matchedEf = efData?.find((ef: any) => ef.ef_id === item.ef_id);
            return {
              ...item,
              emission_factor: matchedEf ? matchedEf.ef_value : 0,
              ef_name: matchedEf ? matchedEf.ef_name : '',
            };
          });
          setAdminActivities(formatted);
        }
      } catch (err) {
        console.error("ไม่สามารถดึงข้อมูลได้:", err);
      } finally {
        setLoadingActivities(false);
      }
    }

    fetchMasterData();
  }, []);

  const handleCalculateAndSave = async () => {
    if (!meeting && !travel && resources.length === 0) {
      alert("กรุณากรอกข้อมูลอย่างน้อย 1 หมวดก่อนทำการคำนวณและบันทึก");
      return;
    }

    setIsCalculated(true);
    setIsSaving(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert("กรุณาเข้าสู่ระบบก่อนทำการบันทึกข้อมูล");
        setIsSaving(false);
        return;
      }

      const orgId = user.id;
      let mTotal = 0;
      let tTotal = 0;
      let rTotal = 0;

      const recordsToInsert = [];

      // 1. หมวดการประชุม
      if (meeting && meeting.activity_id) {
        const actInfo = adminActivities.find(a => a.activity_id === meeting.activity_id);
        const ef = Number(actInfo?.emission_factor) || 0.5;
        const totalAmount = meeting.durationHours * meeting.participants;
        const res = executeCarbonCalculation({ emissionFactor: ef, amount: totalAmount });
        mTotal = res.totalCalculated;
        setMeetingRes(mTotal);

        recordsToInsert.push({
          category_name: actInfo?.category_name || "การประชุม",
          sub_category: actInfo?.sub_category || "ประชุมทั่วไป",
          ef_id: actInfo?.ef_id || null,
          unit: actInfo?.unit || "hours",
          org_id: orgId,
          activity_name: meeting.meetingName,
          persons: meeting.participants,
          hours: meeting.durationHours,
          trips: null,
          distance: null,
          fuel: null,
          water: null,
          total_calculated: mTotal,
        });
      }

      // 2. หมวดการเดินทาง
      if (travel && travel.activity_id) {
        const actInfo = adminActivities.find(a => a.activity_id === travel.activity_id);
        const ef = Number(actInfo?.emission_factor) || 0.2;
        const totalAmount = travel.distanceKm * travel.trips * travel.passengers;
        const res = executeCarbonCalculation({ emissionFactor: ef, amount: totalAmount });
        tTotal = res.totalCalculated;
        setTravelRes(tTotal);

        recordsToInsert.push({
          category_name: actInfo?.category_name || "การเดินทาง",
          sub_category: actInfo?.sub_category || "เดินทางทั่วไป",
          ef_id: actInfo?.ef_id || null,
          unit: actInfo?.unit || "km",
          org_id: orgId,
          activity_name: travel.travelName,
          persons: travel.passengers,
          hours: null,
          trips: travel.trips,
          distance: travel.distanceKm,
          fuel: null,
          water: null,
          total_calculated: tTotal,
        });
      }

      // 3. หมวดทรัพยากร
      if (resources.length > 0) {
        resources.forEach(resItem => {
          if (!resItem.activity_id) return;
          const actInfo = adminActivities.find(a => a.activity_id === resItem.activity_id);
          const ef = Number(actInfo?.emission_factor) || 0.1;
          const res = executeCarbonCalculation({ emissionFactor: ef, amount: resItem.amount });
          rTotal += res.totalCalculated;

          recordsToInsert.push({
            category_name: actInfo?.category_name || "พลังงานและทรัพยากร",
            sub_category: actInfo?.sub_category || "ทรัพยากรทั่วไป",
            ef_id: actInfo?.ef_id || null,
            unit: actInfo?.unit || "-",
            org_id: orgId,
            activity_name: resItem.resourceName,
            persons: null,
            hours: null,
            trips: null,
            distance: null,
            fuel: resItem.amount,
            water: null,
            total_calculated: res.totalCalculated,
          });
        });
        setResourceRes(rTotal);
      }

      // บันทึกลงตาราง activity_based โดยตรง
      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('activity_based')
          .insert(recordsToInsert);

        if (insertError) throw insertError;
      }

      alert("คำนวณและบันทึกข้อมูลลงตาราง activity_based สำเร็จ!");
    } catch (error: any) {
      console.error("เกิดข้อผิดพลาดในการบันทึก:", error.message || error);
      alert(`เกิดข้อผิดพลาด: ${error.message || "กรุณาตรวจสอบ Console"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 font-['Be_Vietnam_Pro']">
      <h1 className="text-2xl font-bold text-gray-900">
        การประเมินคาร์บอนฟุตพริ้นท์องค์กร (Activity-Based)
      </h1>

      <FootprintStepper current={3} />

      {loadingActivities ? (
        <div className="text-center py-8 text-gray-500">กำลังโหลดรายการกิจกรรม...</div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start gap-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <Sparkles className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-emerald-800">
              บันทึกกิจกรรมขององค์กร ระบบจะคำนวณและจัดเก็บข้อมูลลงตาราง activity_based โดยอัตโนมัติ
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <MeetingForm onSubmit={(data) => { setMeeting(data); setIsCalculated(false); }} adminActivities={adminActivities} />
            <TravelForm onSubmit={(data) => { setTravel(data); setIsCalculated(false); }} adminActivities={adminActivities} />
            <ResourceForm onSubmit={(data) => { setResources(data); setIsCalculated(false); }} adminActivities={adminActivities} />
          </div>

          <div>
            <button
              type="button"
              onClick={handleCalculateAndSave}
              disabled={isSaving}
              className="rounded-xl bg-[#32885F] px-8 py-4 font-semibold text-white transition hover:bg-[#286e4d] disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              <Calculator className="w-5 h-5" /> {isSaving ? "กำลังบันทึก..." : "คำนวณและบันทึก Carbon Footprint"}
            </button>
          </div>

          {isCalculated && (
            <CalculationResult
              meetingEmission={meetingRes}
              travelEmission={travelRes}
              resourceEmission={resourceRes}
            />
          )}
        </div>
      )}
    </div>
  );
}