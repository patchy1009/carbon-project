"use client";

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./components/MeetingForm";
import TravelForm, { TravelData } from "./components/TravelForm";
import CalculationResult from "./components/CalculationResult";
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

export default function ActivityBasedFootprintPage() {
  // State จัดเก็บข้อมูลแบบฟอร์ม
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);

  // State จัดเก็บข้อมูล Master Data & การโหลด
  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [emissionFactorsList, setEmissionFactorsList] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State จัดเก็บผลลัพธ์การคำนวณ
  const [meetingEmissionTon, setMeetingEmissionTon] = useState<number>(0);
  const [travelEmissionTon, setTravelEmissionTon] = useState<number>(0);
  const [meetingRawElectricityKWh, setMeetingRawElectricityKWh] = useState<number>(0);
  const [meetingElectricityCost, setMeetingElectricityCost] = useState<number>(0);

  // State จัดเก็บข้อเสนอแนะ (Recommendation)
  const [meetingRecommendation, setMeetingRecommendation] = useState<any>(null);
  const [travelRecommendation, setTravelRecommendation] = useState<any>(null);

  // ดึงข้อมูล Emission Factor สำหรับคำนวณ
  useEffect(() => {
    async function fetchMasterData() {
      try {
        const { data: efData, error: efError } = await supabase
          .from('emission_factor')
          .select('*, eftype:eftype_id (type_name)');
        
        if (efError) throw efError;
        if (efData) setEmissionFactorsList(efData);
      } catch (err) {
        console.error("ไม่สามารถดึงข้อมูล Emission Factor ได้:", err);
      } finally {
        setLoadingActivities(false);
      }
    }

    fetchMasterData();
  }, []);

  // ฟังก์ชันดึงค่า Emission Factor จากฐานข้อมูล
  const fetchEFFromTwoCategories = (fuelKey: string): number => {
    if (!fuelKey) return 0;
    const lowerKey = fuelKey.toLowerCase().trim();

    let targetKeyword = lowerKey;
    if (lowerKey === 'electricity' || lowerKey === 'ev') {
      targetKeyword = 'ไฟฟ้าแบบ grid mix ปี 2022–2024';
    } else if (lowerKey.includes('gasohol_e10')) targetKeyword = 'gasohol e10';
    else if (lowerKey.includes('gasohol_e20')) targetKeyword = 'gasohol e20';
    else if (lowerKey.includes('gasohol_e85')) targetKeyword = 'gasohol e85';
    else if (lowerKey.includes('diesel_b7')) targetKeyword = 'diesel b7';
    else if (lowerKey.includes('diesel_b20')) targetKeyword = 'diesel b20';
    else if (lowerKey.includes('lpg')) targetKeyword = 'lpg';
    else if (lowerKey.includes('cng')) targetKeyword = 'cng';

    let matchedItem = emissionFactorsList.find((ef: any) => {
      const typeName = (ef.eftype?.type_name || '').toLowerCase();
      const efName = (ef.ef_name || '').toLowerCase();
      return typeName.includes('on-road vehicles') && efName.includes(targetKeyword);
    });

    if (!matchedItem) {
      matchedItem = emissionFactorsList.find((ef: any) => {
        const typeName = (ef.eftype?.type_name || '').toLowerCase();
        const efName = (ef.ef_name || '').toLowerCase();
        return typeName.includes('electricity') && efName.includes(targetKeyword);
      });
    }

    return matchedItem ? Number(matchedItem.ef_value) || 0 : 0;
  };

  const fetchElectricityEFFromDB = (): number => {
    const matchedItem = emissionFactorsList.find((ef: any) => {
      const typeName = (ef.eftype?.type_name || '').toLowerCase();
      const efName = (ef.ef_name || '').toLowerCase();
      return typeName.includes('electricity') && efName.includes('ไฟฟ้าแบบ grid mix ปี 2022–2024');
    });
    return matchedItem ? Number(matchedItem.ef_value) || 0 : 0;
  };

  // ฟังก์ชันหลักคำนวณและบันทึกข้อมูลแบบ Master-Detail ลงตาราง general_activity
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
      const electricityEf = fetchElectricityEFFromDB();
      if (electricityEf === 0) {
        alert("ไม่พบค่า Emission Factor ของไฟฟ้า กรุณาตรวจสอบการตั้งค่าของแอดมิน");
        setIsSaving(false);
        return;
      }

      let eventCalculatedTotal = 0;
      let travelCalculatedTotal = 0;
      let totalElectricityKWh = 0;
      let totalCostVal = 0;

      let meetingSummaryRes = null;
      let travelSummaryRes = null;

      // 1. ประมวลผลหมวดการประชุม
      if (meeting) {
        const isMeetingEv = meeting.meetingType === 'onsite' && meeting.fuelType?.toLowerCase() === 'ev';
        const rawFuel = meeting.meetingType === 'online' ? 'electricity' : (isMeetingEv ? 'electricity' : (meeting.fuelType || 'gasohol_e10'));
        const dbEfValue = meeting.meetingType === 'online' ? electricityEf : fetchEFFromTwoCategories(rawFuel);

        if (dbEfValue === 0) {
          alert(`ไม่พบค่า Emission Factor สำหรับ (${rawFuel})`);
          setIsSaving(false);
          return;
        }

        const calcInput = {
          category: 'meeting' as const,
          subCategory: meeting.meetingType,
          fuelType: rawFuel.toLowerCase(),
          distance: meeting.distanceKm,
          trip: meeting.trips,
          durationHours: meeting.durationHours,
          equipmentSets: meeting.equipmentSets,
          emissionFactor: dbEfValue,
          electricityEmissionFactor: electricityEf,
        };

        meetingSummaryRes = calculateMeetingSummary(calcInput);

        setMeetingEmissionTon(meetingSummaryRes.totalCalculatedTon);
        setMeetingRawElectricityKWh(meetingSummaryRes.rawElectricityKWh);
        setMeetingElectricityCost(meetingSummaryRes.electricityCost);

        eventCalculatedTotal = meetingSummaryRes.totalCalculatedTon;
        totalElectricityKWh += meetingSummaryRes.rawElectricityKWh || 0;
        totalCostVal += meetingSummaryRes.electricityCost || 0;

        const meetingOptions: OptionType[] = [
          { subCategory: 'online', fuelType: 'electricity', name: 'การประชุมออนไลน์ (Online)' },
          { subCategory: 'ev', fuelType: 'electricity', name: 'ประชุมออนไซต์ รถไฟฟ้า EV' },
          { subCategory: 'car', fuelType: 'gasohol_e20', name: 'ประชุมออนไซต์ รถยนต์ (Gasohol E20)' },
          { subCategory: 'motorcycle', fuelType: 'gasohol_e10', name: 'ประชุมออนไซต์ รถจักรยานยนต์' },
        ];

        setMeetingRecommendation(getMeetingRecommendations({
          currentEmission: meetingSummaryRes.totalCalculatedTon,
          userInput: calcInput,
          allAvailableOptions: meetingOptions,
          fetchEFFromDB: fetchEFFromTwoCategories,
          fetchElectricityEFFromDB,
        }));
      }

      // 2. ประมวลผลหมวดการเดินทาง
      if (travel) {
        const isEv = travel.vehicleType.toLowerCase() === 'ev';
        const rawTravelFuel = isEv ? 'electricity' : (travel.fuelType || 'gasohol_e10');
        const dbEfValue = fetchEFFromTwoCategories(rawTravelFuel);

        if (dbEfValue === 0) {
          alert(`ไม่พบค่า Emission Factor สำหรับ (${rawTravelFuel})`);
          setIsSaving(false);
          return;
        }

        const calcInput = {
          category: 'travel' as const,
          subCategory: travel.vehicleType.toLowerCase(),
          fuelType: rawTravelFuel.toLowerCase(),
          distance: travel.distanceKm,
          trip: travel.trips,
          electricityKWh: travel.electricityKwh,
          emissionFactor: dbEfValue,
          electricityEmissionFactor: electricityEf,
        };

        travelSummaryRes = calculateTravelSummary(calcInput);

        setTravelEmissionTon(travelSummaryRes.totalCalculatedTon);
        travelCalculatedTotal = travelSummaryRes.totalCalculatedTon;
        totalElectricityKWh += travel.electricityKwh || 0;

        const travelOptions: OptionType[] = [];
        Object.entries(VEHICLE_FUEL_MAPPINGS).forEach(([v, fuels]) => {
          fuels.forEach(f => travelOptions.push({ subCategory: v, fuelType: f, name: `${v} (${f})` }));
        });

        setTravelRecommendation(getTravelRecommendations({
          currentEmission: travelSummaryRes.totalCalculatedTon,
          userInput: calcInput,
          allAvailableOptions: travelOptions,
          fetchEFFromDB: fetchEFFromTwoCategories,
        }));
      }

      const grandTotalCalculated = Number((eventCalculatedTotal + travelCalculatedTotal).toFixed(4));
      
      // ดึงค่า ef_id ที่ผู้ใช้เลือกจากฟอร์ม
      const selectedEfId = meeting?.ef_id || travel?.ef_id || null;

      // 3. บันทึกข้อมูลลงตารางแม่ (general_activity)
      const { data: parentData, error: parentError } = await supabase
        .from("general_activity")
        .insert([
          {
            org_id: orgId,
            activity_name: meeting?.meetingName || travel?.travelName || "กิจกรรมทั่วไปขององค์กร",
            category_name: meeting ? "การประชุม อบรม และจัดกิจกรรม" : "การเดินทาง",
            sub_category: meeting ? meeting.meetingType : travel?.vehicleType.toLowerCase(),
            ef_id: selectedEfId, // เชื่อมโยงรหัส ef_id ที่ถูกต้อง
            unit: meeting ? "kWh/km" : (travel?.vehicleType.toLowerCase() === 'ev' ? 'kWh' : 'km'),
            total_calculated: grandTotalCalculated,
            total_event_calculated: Number(eventCalculatedTotal.toFixed(4)),
            total_travel_calculated: Number(travelCalculatedTotal.toFixed(4)),
            total_electricity_calculated: Number(totalElectricityKWh.toFixed(4)),
            total_cost_calculated: Number(totalCostVal.toFixed(2)),
            updated_at: new Date().toISOString(),
          },
        ])
        .select("general_activity_id")
        .single();

      if (parentError || !parentData) {
        throw parentError || new Error("ไม่สามารถบันทึกข้อมูลตารางแม่ได้");
      }

      const newActivityId = parentData.general_activity_id;

      // 4. บันทึกข้อมูลลงตารางลูก (general_activity_event_detail)
      if (meeting && meeting.equipmentSets && meeting.equipmentSets.length > 0) {
        for (const set of meeting.equipmentSets) {
          await supabase.from("general_activity_event_detail").insert([
            {
              general_activity_id: newActivityId,
              hours: set.durationHours,
              devices: set.devices,
              equipment_name: set.equipmentName,
            },
          ]);
        }
      }

      // 5. บันทึกข้อมูลลงตารางลูก (general_activity_travel_detail)
      if (travel) {
        await supabase.from("general_activity_travel_detail").insert([
          {
            general_activity_id: newActivityId,
            trips: travel.trips,
            distance: travel.distanceKm || 0,
            fuel_type: travel.vehicleType.toLowerCase(),
          },
        ]);
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
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 font-['Be_Vietnam_Pro'] text-gray-800">
      <h1 className="text-2xl font-bold text-gray-900">
        การประเมินคาร์บอนฟุตพริ้นท์องค์กร (Activity-Based)
      </h1>

      <FootprintStepper current={3} />

      {loadingActivities ? (
        <div className="text-center py-8 text-gray-500">กำลังโหลดระบบ...</div>
      ) : (
        <div className="space-y-6">
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
            meetingEmission={meetingEmissionTon}
            travelEmission={travelEmissionTon}
            resourceEmission={0}
            meetingRawElectricityKWh={meetingRawElectricityKWh}
            meetingElectricityCost={meetingElectricityCost}
            meetingRecommendation={meetingRecommendation}
            travelRecommendation={travelRecommendation}
          />
        </div>
      )}
    </div>
  );
}