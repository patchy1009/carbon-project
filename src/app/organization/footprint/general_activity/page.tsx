"use client";

/* ===================== [MERGE aom + cyn2 รอบ 2] =====================
 * หน้านี้ = ฟีเจอร์ของ cyn2 ทั้งไฟล์ (cyn2 ย้ายจาก footprint/activity_based มาเป็น footprint/general_activity)
 *   ขั้นที่ 3 ของการบันทึก Carbon Footprint: "กิจกรรมพิเศษ" — การประชุม/อบรม/อีเวนต์ และการเดินทาง
 *   ของใหม่จาก cyn2: บันทึกลงตาราง general_activity_meeting / general_activity_traveling (แทน activity_based)
 *                   เลือกกิจกรรมเก่ามาแก้/ลบได้ และดาวน์โหลดผลเป็น PDF (./pdf/route.tsx)
 * แก้แค่ฟอนต์ [MERGE-FIX] ให้เหมือนหน้าอื่น (แบบเดียวกับรอบแรก)
 * ทางเข้า: ปุ่ม "บันทึกกิจกรรมพิเศษ (ขั้นที่ 3)" ในกล่องบันทึกเสร็จของขั้นที่ 2 (FootprintClient.tsx ของ aom)
 * ข้อควรรู้: ข้อมูลที่บันทึกที่นี่ยังไม่ผูกกับรายการ org_activity_list ของ aom -> ยังไม่รวมใน report / dashboard
 *           ตาราง general_activity_* ต้องมี RLS (supabase/rls_general_activity.sql) ไม่งั้นองค์กรเห็นข้อมูลกันเอง
 * ============================================================== */

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./MeetingForm";
import TravelForm, { TravelData } from "./TravelForm";
import CalculationResult from "./CalculationResult";
import {
  calculateMeetingSummary,
  calculateTravelSummary,
  getTravelRecommendations,
  getMeetingRecommendations,
  VEHICLE_FUEL_MAPPINGS,
  OptionType
} from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";
import { Calculator } from "lucide-react";
import { useRouter } from "next/navigation"; // [MERGE รอบ 2] ปุ่ม "‹ กลับ" ไปขั้นที่ 2

export default function ActivityBasedFootprintPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const router = useRouter();

  // [MERGE รอบ 2] ปุ่ม "‹ กลับ": กลับไปขั้นที่ 2 ถ้ามาจากรายการที่แก้อยู่ (?edit=) กลับไปรายการนั้น
  const goBack = () => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    // มาจากปุ่มในหน้ารายงาน (&from=report) -> กลับไปหน้ารายงานเดิม
    if (editId && params.get("from") === "report") {
      router.push(`/organization/footprint/report?id=${encodeURIComponent(editId)}`);
      return;
    }
    router.push(editId ? `/organization/footprint/activity?edit=${encodeURIComponent(editId)}` : "/organization/footprint/activity");
  };
  const [emissionFactorsList, setEmissionFactorsList] = useState<any[]>([]);
  const [loadingSystem, setLoadingSystem] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);

  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [travelingData, setTravelingData] = useState<TravelData | null>(null);

  const [meetingEmissionTon, setMeetingEmissionTon] = useState<number>(0);
  const [travelingEmissionTon, setTravelingEmissionTon] = useState<number>(0);
  
  const [meetingRawElectricityKWh, setMeetingRawElectricityKWh] = useState<number>(0);
  const [meetingElectricityCost, setMeetingElectricityCost] = useState<number>(0);

  const [travelingRawElectricityKWh, setTravelingRawElectricityKWh] = useState<number>(0);
  const [travelingElectricityCost, setTravelingElectricityCost] = useState<number>(0);

  const [meetingRecommendation, setMeetingRecommendation] = useState<any>(null);
  const [travelingRecommendation, setTravelingRecommendation] = useState<any>(null);

  useEffect(() => {
    async function initSystem() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          alert("กรุณาเข้าสู่ระบบก่อนใช้งานระบบประเมินคาร์บอนฟุตพรินต์");
          return;
        }
        setOrgId(user.id);

        const { data: efData } = await supabase
          .from('emission_factor')
          .select('*, eftype:eftype_id (type_name)');
        
        if (efData) setEmissionFactorsList(efData);
      } catch (err) {
        console.error("System init error:", err);
      } finally {
        setLoadingSystem(false);
      }
    }
    initSystem();
  }, []);

  const fetchElectricityEFFromDB = () => {
    const matchedItem = emissionFactorsList.find((ef: any) => {
      const efName = (ef.ef_name || '').toLowerCase();
      const efType = (ef.eftype?.type_name || '').toLowerCase();
      return efName.includes('grid') || efName.includes('ไฟฟ้า') || efType.includes('electricity');
    });

    return {
      id: matchedItem ? (matchedItem.ef_id || matchedItem.id || null) : null,
      value: matchedItem ? Number(matchedItem.ef_value) || 0.4999 : 0.4999
    };
  };

  const getEFDetail = (fuelKey: string) => {
    if (!fuelKey) return { id: null, value: 0.5 };
    const lowerKey = fuelKey.toLowerCase().trim();
    let targetKeyword = lowerKey;
    if (lowerKey === 'electricity' || lowerKey === 'ev' || lowerKey === 'online') {
      targetKeyword = 'grid';
    } else if (lowerKey.includes('gasohol_e10')) targetKeyword = 'gasohol e10';
    else if (lowerKey.includes('gasohol_e20')) targetKeyword = 'gasohol e20';
    else if (lowerKey.includes('gasohol_e85')) targetKeyword = 'gasohol e85';
    else if (lowerKey.includes('diesel_b7')) targetKeyword = 'diesel b7';
    else if (lowerKey.includes('diesel_b20')) targetKeyword = 'diesel b20';
    else if (lowerKey.includes('lpg')) targetKeyword = 'lpg';
    else if (lowerKey.includes('cng')) targetKeyword = 'cng';

    const matchedItem = emissionFactorsList.find((ef: any) => {
      const efName = (ef.ef_name || '').toLowerCase();
      const efType = (ef.eftype?.type_name || '').toLowerCase();
      const efFuelType = (ef.fuel_type || '').toLowerCase();
      return efName.includes(targetKeyword) || efType.includes(targetKeyword) || efFuelType.includes(targetKeyword);
    });

    return {
      id: matchedItem ? (matchedItem.ef_id || matchedItem.id || null) : null,
      value: matchedItem ? Number(matchedItem.ef_value) || 0.5 : 0.5
    };
  };

  const handleCalculateAndSave = async () => {
    if (!orgId) {
      alert("ไม่พบข้อมูลรหัสองค์กร กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    if (!meetingData && !travelingData) {
      alert("กรุณากรอกข้อมูลการประชุม หรือข้อมูลการเดินทางอย่างน้อย 1 หมวดก่อนคำนวณ");
      return;
    }

    setIsSaving(true);

    try {
      const electricityEfObj = fetchElectricityEFFromDB();

      // 1. หมวดการประชุม
      if (meetingData) {
        const isOnline = meetingData.category_type === 'online';
        const isMeetingEv = meetingData.category_type === 'onsite' && meetingData.fuelType?.toLowerCase() === 'ev';
        const rawFuel = isOnline ? 'electricity' : (isMeetingEv ? 'electricity' : (meetingData.fuelType || 'gasohol_e10'));
        const meetingEfObj = isOnline ? electricityEfObj : getEFDetail(rawFuel);

        const calcInput = {
          category: 'meeting' as const,
          category_type: meetingData.category_type,
          fuelType: rawFuel.toLowerCase(),
          distance: meetingData.distanceKm,
          trip: meetingData.trips,
          durationHours: meetingData.durationHours,
          equipmentSets: meetingData.equipmentSets,
          emissionFactor: meetingEfObj.value,
          electricityEmissionFactor: electricityEfObj.value,
          efId: meetingEfObj.id,
        };

        const summary = calculateMeetingSummary(calcInput);
        setMeetingEmissionTon(summary.totalCalculatedTon);
        setMeetingRawElectricityKWh(summary.rawElectricityKWh);
        setMeetingElectricityCost(summary.electricityCost);

        const meetingOptions: OptionType[] = [
          { category_type: 'online', fuelType: 'electricity', name: 'การประชุมออนไลน์ (Online)' },
          { category_type: 'ev', fuelType: 'electricity', name: 'ประชุมออนไซต์ รถไฟฟ้า EV' },
          { category_type: 'car', fuelType: 'gasohol_e20', name: 'ประชุมออนไซต์ รถยนต์ (Gasohol E20)' },
          { category_type: 'motorcycle', fuelType: 'gasohol_e10', name: 'ประชุมออนไซต์ รถจักรยานยนต์' },
        ];

        setMeetingRecommendation(getMeetingRecommendations({
          currentEmission: summary.totalCalculatedTon,
          userInput: calcInput,
          allAvailableOptions: meetingOptions,
          fetchEFFromDB: (fuelKey) => getEFDetail(fuelKey).value,
          fetchElectricityEFFromDB: () => electricityEfObj.value,
        }));

        const activityName = meetingData.meetingName || 'การประชุม';
        const firstSet = meetingData.equipmentSets?.[0];
        const userEnteredKwh = firstSet?.electricityKwh || 0;

        // ลบข้อมูลเก่าที่มีชื่อกิจกรรมเดียวกันทิ้งก่อน (รองรับการอัปเดต/แก้ไข)
        await supabase
          .from("general_activity_meeting")
          .delete()
          .eq("org_id", orgId)
          .eq("activity_name", activityName);

        // บันทึกข้อมูลใหม่ลงตาราง general_activity_meeting (เก็บค่า kWh ที่ผู้ใช้กรอกจริง)
        const { error } = await supabase.from("general_activity_meeting").insert([{
          org_id: orgId,
          activity_name: activityName,
          category_type: meetingData.category_type,
          hours: firstSet?.durationHours || meetingData.durationHours || 1,
          devices: firstSet?.devices || 1,
          equipment_name: firstSet?.equipmentName || 'อุปกรณ์การประชุม',
          vehicle_type: isOnline ? null : (meetingData.vehicleType || null),
          fuel_type: isOnline ? null : rawFuel,
          ef_id: meetingEfObj.id,
          distance: isOnline ? 0 : (meetingData.distanceKm || 0),
          trips: isOnline ? 0 : (meetingData.trips || 1),
          electricity_kwh: userEnteredKwh,
        }]);

        if (error) throw error;
      }

      // 2. หมวดการเดินทาง
      if (travelingData) {
        const isEv = travelingData.vehicleType.toLowerCase() === 'ev';
        const rawTravelingFuel = isEv ? 'electricity' : (travelingData.fuelType || 'gasohol_e10');
        const travelingEfObj = getEFDetail(rawTravelingFuel);

        const calcInput = {
          category: 'travel' as const,
          category_type: travelingData.vehicleType.toLowerCase(),
          fuelType: rawTravelingFuel.toLowerCase(),
          distance: travelingData.distanceKm,
          trip: travelingData.trips,
          electricityKWh: travelingData.electricityKwh,
          emissionFactor: travelingEfObj.value,
          electricityEmissionFactor: electricityEfObj.value,
          efId: travelingEfObj.id,
        };

        const summary = calculateTravelSummary(calcInput);
        setTravelingEmissionTon(summary.totalCalculatedTon);
        setTravelingRawElectricityKWh(summary.rawElectricityKWh || 0);
        setTravelingElectricityCost(summary.electricityCost || 0);

        const travelingOptions: OptionType[] = [];
        Object.entries(VEHICLE_FUEL_MAPPINGS).forEach(([v, fuels]) => {
          fuels.forEach(f => travelingOptions.push({ category_type: v, fuelType: f, name: `${v} (${f})` }));
        });

        setTravelingRecommendation(getTravelRecommendations({
          currentEmission: summary.totalCalculatedTon,
          userInput: calcInput,
          allAvailableOptions: travelingOptions,
          fetchEFFromDB: (fuelKey) => getEFDetail(fuelKey).value,
        }));

        const travelActivityName = travelingData.travel_name || 'การเดินทาง';
        const userEnteredTravelKwh = isEv ? (travelingData.electricityKwh || 0.16) : 0;

        // ลบข้อมูลเก่าที่มีชื่อกิจกรรมการเดินทางเดียวกันทิ้งก่อน (รองรับการอัปเดต/แก้ไข)
        await supabase
          .from("general_activity_traveling")
          .delete()
          .eq("org_id", orgId)
          .eq("activity_name", travelActivityName);

        // บันทึกข้อมูลใหม่ลงตาราง general_activity_traveling (เก็บค่า kWh ที่ผู้ใช้กรอกจริงสำหรับ EV)
        const { error } = await supabase.from("general_activity_traveling").insert([{
          org_id: orgId,
          activity_name: travelActivityName,
          category_type: travelingData.category_type,
          trips: travelingData.trips,
          distance: travelingData.distanceKm || 0,
          vehicle_type: travelingData.vehicleType.toLowerCase(),
          fuel_type: rawTravelingFuel,
          ef_id: travelingEfObj.id,
          electricity_kwh: userEnteredTravelKwh,
        }]);

        if (error) throw error;
      }

      setHasCalculated(true);
      alert("คำนวณและบันทึกข้อมูลลงฐานข้อมูลสำเร็จเรียบร้อยแล้ว!");
    } catch (error: any) {
      console.error("Save error:", error);
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingSystem) {
    return <div className="text-center py-16 text-gray-500 font-medium">กำลังโหลดระบบ...</div>;
  }

  return (
    // [MERGE-FIX] เดิมมี font-['Be_Vietnam_Pro'] แต่เว็บไม่ได้โหลดฟอนต์นี้ -> เอาออก ใช้ฟอนต์หลักของเว็บเหมือนหน้าอื่น
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 text-gray-800">
      <h1 className="text-2xl font-bold text-gray-900">การประเมินคาร์บอนฟุตพรินต์องค์กร</h1>
      <FootprintStepper current={3} />

      <div className="space-y-6">
        <MeetingForm orgId={orgId!} onDataChange={setMeetingData} fetchElectricityEF={fetchElectricityEFFromDB} getEFDetail={getEFDetail} />
        <TravelForm orgId={orgId!} onDataChange={setTravelingData} fetchElectricityEF={fetchElectricityEFFromDB} getEFDetail={getEFDetail} />

        {/* [MERGE รอบ 2] เพิ่มปุ่ม "‹ กลับ" (ทรงเดียวกับขั้นที่ 1-2) ข้างปุ่มคำนวณของ cyn2 */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            onClick={goBack}
            className="btn btn-outline flex h-[60px] items-center rounded-[20px] px-8 text-base font-semibold"
          >
            ‹ กลับ
          </button>
          <button
            type="button"
            onClick={handleCalculateAndSave}
            disabled={isSaving}
            className="w-full sm:w-auto rounded-xl bg-[#32885F] px-8 py-4 font-semibold text-white transition hover:bg-[#286e4d] disabled:opacity-50 shadow-md flex items-center justify-center gap-2 text-base"
          >
            <Calculator className="w-5 h-5" />
            {isSaving ? "กำลังคำนวณและบันทึก..." : "คำนวณและบันทึกข้อมูลลงฐานข้อมูล"}
          </button>
        </div>

        {hasCalculated && (
          <CalculationResult
            meetingEmission={meetingEmissionTon}
            travelEmission={travelingEmissionTon}
            meetingRawElectricityKWh={meetingRawElectricityKWh}
            meetingElectricityCost={meetingElectricityCost}
            travelRawElectricityKWh={travelingRawElectricityKWh}
            travelElectricityCost={travelingElectricityCost}
            meetingRecommendation={meetingRecommendation}
            travelRecommendation={travelingRecommendation}
          />
        )}
      </div>
    </div>
  );
}