"use client";

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./components/MeetingForm";
import TravelForm, { TravelData } from "./components/TravelForm";
import ResourceForm, { ResourceData } from "./components/ResourceForm";
import CalculationResult from "./components/CalculationResult";
import {
  executeCarbonCalculation,
  compareGenericChoices,
  CalculationResult as CalcResultType,
  RecommendationResult,
} from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";
import { Sparkles, BarChart2 } from "lucide-react";

export default function ActivityBasedFootprintPage() {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);
  const [resources, setResources] = useState<ResourceData[]>([]);
  
  const [isCalculated, setIsCalculated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State เก็บรายการกิจกรรมจากตารางใหม่ activity_based
  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // State ผลลัพธ์และคำแนะนำ
  const [meetingRes, setMeetingRes] = useState<CalcResultType | null>(null);
  const [travelRes, setTravelRes] = useState<CalcResultType | null>(null);
  const [resourceRes, setResourceRes] = useState<number>(0);
  const [meetingRec, setMeetingRec] = useState<RecommendationResult | null>(null);
  const [travelRec, setTravelRec] = useState<RecommendationResult | null>(null);

  // ดึงข้อมูล Master Data จากตารางใหม่ activity_based พร้อม JOIN เอาค่า emission_factor มาจากตาราง emission_factor กลาง
  useEffect(() => {
    async function fetchAdminActivities() {
      try {
        const { data, error } = await supabase
          .from('activity_based')
          .select(`
            *,
            emission_factor (
              ef_id,
              ef_name,
              ef_value,
              real_unit
            )
          `);
        
        if (error) throw error;
        if (data) {
          // แมปข้อมูลให้เข้าถึง ef_value ได้ง่ายขึ้นตามโครงสร้างเดิม
          const formatted = data.map((item: any) => ({
            ...item,
            emission_factor: item.emission_factor?.ef_value ?? 0,
            ef_name: item.emission_factor?.ef_name ?? '',
          }));
          setAdminActivities(formatted);
        }
      } catch (err) {
        console.error("ไม่สามารถดึงข้อมูลกิจกรรมจากแอดมินได้:", err);
      } finally {
        setLoadingActivities(false);
      }
    }

    fetchAdminActivities();
  }, []);

  const handleMeetingSubmit = (data: MeetingData) => {
    setMeeting(data);
    setIsCalculated(false);
  };

  const handleTravelSubmit = (data: TravelData) => {
    setTravel(data);
    setIsCalculated(false);
  };

  const handleResourceSubmit = (data: ResourceData[]) => {
    setResources(data);
    setIsCalculated(false);
  };

  const handleCalculateAndSave = async () => {
    if (!meeting && !travel && resources.length === 0) {
      alert("กรุณากรอกข้อมูลอย่างน้อย 1 หมวดก่อนทำการคำนวณ");
      return;
    }

    setIsCalculated(true);
    setIsSaving(true);

    try {
      let mRes: CalcResultType | null = null;
      let tRes: CalcResultType | null = null;
      let rTotal = 0;

      // 1. คำนวณหมวดการประชุม
      if (meeting) {
        const selectedAct = adminActivities.find(a => a.activity_id === meeting.activity_id);
        const realEF = selectedAct?.emission_factor ?? 0.5;
        const totalAmount = meeting.durationHours * meeting.participants;

        mRes = executeCarbonCalculation({
          emissionFactor: realEF,
          amount: totalAmount,
        });
        setMeetingRes(mRes);

        // เปรียบเทียบกับตัวเลือกอื่นๆ ในหมวดการประชุมเดียวกันจากแอดมิน
        const meetingOptions = adminActivities
          .filter(a => a.category_name?.toLowerCase().includes('meeting') || a.category_name?.toLowerCase().includes('ประชุม'))
          .map(a => ({ name: a.sub_category || a.category_name, ef_value: a.emission_factor ?? 0.5 }));

        const rec = compareGenericChoices({
          currentName: selectedAct?.sub_category || "การประชุมปัจจุบัน",
          currentEmission: mRes.totalCalculated,
          allOptions: meetingOptions.length > 0 ? meetingOptions : [{ name: selectedAct?.sub_category || "ปัจจุบัน", ef_value: realEF }],
          calculateFn: (ef) => totalAmount * ef,
        });
        setMeetingRec(rec);
      }

      // 2. คำนวณหมวดการเดินทาง
      if (travel) {
        const selectedAct = adminActivities.find(a => a.activity_id === travel.activity_id);
        const realEF = selectedAct?.emission_factor ?? 0.2;
        const totalAmount = travel.distanceKm * travel.trips * travel.passengers;

        tRes = executeCarbonCalculation({
          emissionFactor: realEF,
          amount: totalAmount,
        });
        setTravelRes(tRes);

        // เปรียบเทียบกับตัวเลือกอื่นๆ ในหมวดการเดินทางเดียวกันจากแอดมิน
        const travelOptions = adminActivities
          .filter(a => a.category_name?.toLowerCase().includes('travel') || a.category_name?.toLowerCase().includes('เดินทาง'))
          .map(a => ({ name: a.sub_category || a.category_name, ef_value: a.emission_factor ?? 0.2 }));

        const tRec = compareGenericChoices({
          currentName: selectedAct?.sub_category || "การเดินทางปัจจุบัน",
          currentEmission: tRes.totalCalculated,
          allOptions: travelOptions.length > 0 ? travelOptions : [{ name: selectedAct?.sub_category || "ปัจจุบัน", ef_value: realEF }],
          calculateFn: (ef) => totalAmount * ef,
        });
        setTravelRec(tRec);
      }

      // 3. คำนวณหมวดทรัพยากร
      if (resources.length > 0) {
        resources.forEach(res => {
          const selectedAct = adminActivities.find(a => a.activity_id === res.activity_id);
          const realEF = selectedAct?.emission_factor ?? 0.1;

          const resCalc = executeCarbonCalculation({
            emissionFactor: realEF,
            amount: res.amount,
          });
          rTotal += resCalc.totalCalculated;
        });
        setResourceRes(rTotal);
      }

      // 4. บันทึกลง Supabase (บันทึกผลลัพธ์ลงตารางประวัติ หรือตาราง activity_based ตามโครงสร้างใหม่ของคุณ)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert("กรุณาเข้าสู่ระบบก่อนทำการบันทึกข้อมูล");
        setIsSaving(false);
        return;
      }

      // หมายเหตุ: หากมีตารางเก็บประวัติการคำนวณแยกต่างหาก สามารถปรับเปลี่ยนชื่อตารางตรงนี้ได้ตามต้องการครับ
      alert("คำนวณและประมวลผล Carbon Footprint สำเร็จ!");

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
        วิเคราะห์การปล่อยก๊าซเรือนกระจก (Activity-Based)
      </h1>

      <FootprintStepper current={3} />

      {loadingActivities ? (
        <div className="text-center py-8 text-gray-500">
          กำลังโหลดรายการกิจกรรมจริงจากระบบแอดมิน...
        </div>
      ) : (
        <>
          <div className="space-y-6 bg-emerald-50/40 p-6 rounded-2xl border border-emerald-100">
            <div className="flex items-start gap-3 bg-emerald-100/60 p-4 rounded-xl border border-emerald-200">
              <Sparkles className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-900">
                  หมวดที่ 1 และ 2: โซนเปรียบเทียบและแนะนำตัวเลือกที่ดีที่สุด (Smart Recommendation)
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  ระบบเปรียบเทียบทางเลือกจากตัวเลือกทั้งหมดที่แอดมินสร้างไว้โดยอัตโนมัติ
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <MeetingForm onSubmit={handleMeetingSubmit} adminActivities={adminActivities} />
              <TravelForm onSubmit={handleTravelSubmit} adminActivities={adminActivities} />
            </div>
          </div>

          <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="flex items-start gap-3 bg-slate-200/60 p-4 rounded-xl border border-slate-300">
              <BarChart2 className="w-5 h-5 text-slate-700 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  หมวดที่ 3: การใช้พลังงานและทรัพยากร (คำนวณมาตรฐาน)
                </h3>
              </div>
            </div>

            <ResourceForm onSubmit={handleResourceSubmit} adminActivities={adminActivities} />
          </div>

          <div>
            <button
              type="button"
              onClick={handleCalculateAndSave}
              disabled={isSaving}
              className="rounded-xl bg-[#32885F] px-8 py-4 font-semibold text-white transition hover:bg-[#286e4d] disabled:opacity-50 shadow-md"
            >
              {isSaving ? "กำลังบันทึก..." : "คำนวณและบันทึก Carbon Footprint"}
            </button>
          </div>

          {isCalculated && (
            <CalculationResult
              meetingEmission={meetingRes?.totalCalculated ?? 0}
              travelEmission={travelRes?.totalCalculated ?? 0}
              resourceEmission={resourceRes}
              meetingData={meeting}
              travelData={travel}
              meetingRec={meetingRec}
              travelRec={travelRec}
            />
          )}
        </>
      )}
    </div>
  );
}