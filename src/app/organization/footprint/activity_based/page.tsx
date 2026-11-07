"use client";

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./components/MeetingForm";
import TravelForm, { TravelData } from "./components/TravelForm";
import CalculationResult from "./components/CalculationResult";
import { executeCarbonCalculation } from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";
import { Sparkles, Calculator } from "lucide-react";

export default function ActivityBasedFootprintPage() {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);

  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [meetingRes, setMeetingRes] = useState<number>(0);
  const [travelRes, setTravelRes] = useState<number>(0);

  // ดึงข้อมูล Master Data และ Emission Factor จาก Supabase DB
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
              emission_factor: matchedEf ? matchedEf.ef_value : 0, // ค่า EF จริงจาก DB
              ef_name: matchedEf ? matchedEf.ef_name : '',
              ef_id: matchedEf ? matchedEf.ef_id : item.ef_id,
            };
          });
          setAdminActivities(formatted);
        }
      } catch (err) {
        console.error("ไม่สามารถดึงข้อมูล Master Data ได้:", err);
      } finally {
        setLoadingActivities(false);
      }
    }

    fetchMasterData();
  }, []);

  const handleCalculateAndSave = async () => {
    if (!meeting && !travel) {
      alert("กรุณากรอกข้อมูลการประชุม หรือข้อมูลการเดินทางอย่างน้อย 1 หมวดก่อนทำการคำนวณและบันทึก");
      return;
    }

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

      const recordsToInsert = [];

      // 1. หมวดการประชุม (Meeting & Resources) - ดึง EF จาก DB
      if (meeting) {
        // ค้นหาแถว Master Data จาก DB ด้วย activity_id หรือ ef_id ที่ส่งมาจากฟอร์ม
        const meetingActivityId = (meeting as any).activity_id || (meeting as any).ef_id;
        const actInfo = adminActivities.find(a => 
          a.activity_id === meetingActivityId || 
          a.ef_id === meetingActivityId ||
          a.sub_category === (meeting as any).meetingType
        );

        // ดึง ef_value จาก DB (ถ้าหาไม่เจอให้ใช้ 0)
        const dbEfValue = Number(actInfo?.emission_factor) || 0;
        const participants = (meeting as any).participantsOrDevices || (meeting as any).participants || 1;
        
        let totalAmount = 0;
        if (meeting.electricityKwh && meeting.electricityKwh > 0) {
          totalAmount = meeting.electricityKwh; 
        } else {
          totalAmount = (meeting.durationHours || 0) * participants; 
        }

        // คำนวณคาร์บอนด้วย EF จาก Database
        const res = executeCarbonCalculation({ 
          emissionFactor: dbEfValue, 
          amount: totalAmount 
        });
        
        mTotal = res.totalCalculated;
        setMeetingRes(mTotal);

        recordsToInsert.push({
          category_name: actInfo?.category_name || "การประชุม อบรม และจัดอีเวนต์",
          sub_category: actInfo?.sub_category || actInfo?.ef_name || "กิจกรรมการประชุม",
          ef_id: actInfo?.ef_id || null, // FK ที่ผูกกับตาราง emission_factor
          unit: actInfo?.unit || "หน่วย",
          org_id: orgId,
          activity_name: meeting.meetingName,
          persons: participants,
          hours: meeting.durationHours,
          trips: null,
          distance: meeting.distanceKm || null,
          fuel: meeting.electricityKwh || null,
          water: null,
          total_calculated: mTotal,
        });
      }

      // 2. หมวดการเดินทาง (Travel) - ดึง EF จาก DB
      if (travel) {
        // ค้นหาแถว Master Data จาก DB ด้วย activity_id, ef_id หรือ vehicleType ที่ส่งมาจากฟอร์ม
        const travelActivityId = (travel as any).activity_id || (travel as any).ef_id;
        const actInfo = adminActivities.find(a => 
          a.activity_id === travelActivityId || 
          a.ef_id === travelActivityId ||
          a.sub_category === travel.vehicleType ||
          a.activity_name === travel.vehicleType
        );

        // ดึง ef_value จาก DB (ถ้าหาไม่เจอให้ใช้ 0)
        const dbEfValue = Number(actInfo?.emission_factor) || 0;
        const passengers = travel.passengers || 1;
        const trips = travel.trips || 1;
        const distance = travel.distanceKm || 0;

        let totalAmount = 0;
        if (travel.electricityKwh && travel.electricityKwh > 0) {
          totalAmount = travel.electricityKwh; 
        } else {
          // คำนวณปริมาณการใช้งานตามระยะทางและเที่ยว
          totalAmount = distance * trips;
        }

        // คำนวณคาร์บอนด้วย EF จาก Database
        const res = executeCarbonCalculation({ 
          emissionFactor: dbEfValue, 
          amount: totalAmount 
        });

        tTotal = res.totalCalculated;
        setTravelRes(tTotal);

        recordsToInsert.push({
          category_name: actInfo?.category_name || "การเดินทาง และขนส่ง",
          sub_category: actInfo?.sub_category || travel.vehicleType || "ยานพาหนะ",
          ef_id: actInfo?.ef_id || null, // FK ที่ผูกกับตาราง emission_factor
          unit: actInfo?.unit || "km",
          org_id: orgId,
          activity_name: travel.travelName,
          persons: passengers,
          hours: null,
          trips: trips,
          distance: distance || null,
          fuel: travel.electricityKwh || null,
          water: null,
          total_calculated: tTotal,
        });
      }

      // บันทึกลงตาราง activity_based ใน Supabase Direct
      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('activity_based')
          .insert(recordsToInsert);

        if (insertError) throw insertError;
      }

      alert("คำนวณและบันทึกข้อมูลคาร์บอนฟุตพริ้นท์เรียบร้อยแล้ว!");
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
              บันทึกกิจกรรมการประชุม การเดินทาง และการใช้ทรัพยากรขององค์กร ระบบจะคำนวณและจัดเก็บข้อมูลลงระบบโดยอัตโนมัติ
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <MeetingForm 
              onSubmit={(data) => setMeeting(data)} 
              adminActivities={adminActivities} 
            />
            <TravelForm 
              onSubmit={(data) => setTravel(data)} 
              adminActivities={adminActivities} 
            />
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

          <CalculationResult
            meetingEmission={meetingRes}
            travelEmission={travelRes}
            resourceEmission={0}
          />
        </div>
      )}
    </div>
  );
}