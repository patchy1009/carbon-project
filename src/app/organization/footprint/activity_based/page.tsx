"use client";

/* ===================== [MERGE aom + cyn2] =====================
 * หน้านี้ = ฟีเจอร์ใหม่ของ cyn2 ทั้งไฟล์ (แก้แค่ฟอนต์ [MERGE-FIX] ให้เหมือนหน้าอื่น)
 *   ขั้นที่ 3 ของการบันทึก Carbon Footprint: "กิจกรรมพิเศษ" — การประชุม/อบรม/อีเวนต์ และการเดินทาง
 *   คำนวณด้วย ./calculation.ts + แนะนำทางเลือกลดคาร์บอน แล้วบันทึกลงตาราง activity_based
 * ทางเข้า: ปุ่ม "บันทึกกิจกรรมพิเศษ (ขั้นที่ 3)" ในกล่องบันทึกเสร็จของขั้นที่ 2 (FootprintClient.tsx ของ aom)
 * ข้อควรรู้: ข้อมูลที่บันทึกที่นี่ยังไม่ผูกกับรายการ org_activity_list ของ aom
 *   จึงยังไม่ถูกรวมในหน้า report / dashboard ของ aom (ดู booklet หัวข้อช่องโหว่)
 * ============================================================== */

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./components/MeetingForm";
import TravelForm, { TravelData } from "./components/TravelForm";
import CalculationResult from "./components/CalculationResult";
import { 
  executeCarbonCalculation, 
  getTravelRecommendations, 
  getMeetingRecommendations, 
  VEHICLE_FUEL_MAPPINGS,
  OptionType 
} from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";
import { Sparkles, Calculator } from "lucide-react";

export default function ActivityBasedFootprintPage() {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);

  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [emissionFactorsList, setEmissionFactorsList] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [meetingRes, setMeetingRes] = useState<number>(0);
  const [travelRes, setTravelRes] = useState<number>(0);

  const [meetingRecommendation, setMeetingRecommendation] = useState<any>(null);
  const [travelRecommendation, setTravelRecommendation] = useState<any>(null);

  useEffect(() => {
    async function fetchMasterData() {
      try {
        const { data: actData, error: actError } = await supabase.from('activity_based').select('*');
        if (actError) throw actError;

        const { data: efData, error: efError } = await supabase
          .from('emission_factor')
          .select('*, eftype:eftype_id (type_name)');
        if (efError) throw efError;

        if (efData) {
          setEmissionFactorsList(efData);
        }

        if (actData) {
          const formatted = actData.map((item: any) => {
            const matchedEf = efData?.find((ef: any) => ef.ef_id === item.ef_id);
            return {
              ...item,
              emission_factor: matchedEf ? Number(matchedEf.ef_value) : 0,
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

  const fetchEFFromTwoCategories = (fuelKey: string): number => {
    if (!fuelKey) return 0;
    const lowerKey = fuelKey.toLowerCase().trim();

    let targetKeyword = lowerKey;
    if (lowerKey === 'electricity' || lowerKey === 'ev') {
      targetKeyword = 'ไฟฟ้าแบบ grid mix ปี 2022–2024';
    } else if (lowerKey === 'gasohol_e10') {
      targetKeyword = 'gasohol e10';
    } else if (lowerKey === 'gasohol_e20') {
      targetKeyword = 'gasohol e20';
    } else if (lowerKey === 'gasohol_e85') {
      targetKeyword = 'gasohol e85';
    } else if (lowerKey === 'diesel_b7') {
      targetKeyword = 'diesel b7';
    } else if (lowerKey === 'diesel_b20' || lowerKey === 'diesel 20') {
      targetKeyword = 'diesel 20';
    } else if (lowerKey === 'lpg') {
      targetKeyword = 'lpg';
    } else if (lowerKey === 'cng') {
      targetKeyword = 'cng';
    }

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

      const electricityEf = fetchElectricityEFFromDB();
      if (electricityEf === 0) {
        alert("ไม่พบค่า Emission Factor ของไฟฟ้าในหมวด Electricity กรุณาตรวจสอบการตั้งค่าของแอดมิน");
        setIsSaving(false);
        return;
      }

      // 1. หมวดการประชุม
      if (meeting) {
        const isMeetingEv = meeting.meetingType === 'onsite' && meeting.fuelType?.toLowerCase() === 'ev';
        const rawFuel = meeting.meetingType === 'online' ? 'electricity' : (isMeetingEv ? 'electricity' : (meeting.fuelType || 'gasohol_e10'));
        
        const dbEfValue = meeting.meetingType === 'online' ? electricityEf : fetchEFFromTwoCategories(rawFuel);

        if (dbEfValue === 0) {
          alert(`ไม่พบค่า Emission Factor สำหรับ (${rawFuel}) ในหมวด On-road vehicles หรือ Electricity กรุณาตรวจสอบการตั้งค่าของแอดมิน`);
          setIsSaving(false);
          return;
        }
        
        const calcInput = {
          category: 'meeting' as const,
          subCategory: meeting.meetingType,
          fuelType: rawFuel.toLowerCase(),
          distance: meeting.distanceKm,
          trip: meeting.trips,
          devices: meeting.devicesCount,
          durationHours: meeting.durationHours,
          electricityKWh: meeting.electricityKwh,
          equipmentSets: meeting.equipmentSets,
          emissionFactor: dbEfValue,
          electricityEmissionFactor: electricityEf,
        };

        const res = executeCarbonCalculation(calcInput);
        mTotal = res.totalCalculated;
        setMeetingRes(mTotal);

        const meetingOptions: OptionType[] = [
          { subCategory: 'online', fuelType: 'electricity', name: 'การประชุมออนไลน์ (Online)' },
          { subCategory: 'ev', fuelType: 'electricity', name: 'ประชุมออนไซต์ รถไฟฟ้า EV' },
          { subCategory: 'car', fuelType: 'gasohol_e20', name: 'ประชุมออนไซต์ รถยนต์ (Gasohol E20)' },
          { subCategory: 'motorcycle', fuelType: 'gasohol_e10', name: 'ประชุมออนไซต์ รถจักรยานยนต์' },
        ];

        const recMeeting = getMeetingRecommendations({
          currentEmission: mTotal,
          userInput: calcInput,
          allAvailableOptions: meetingOptions,
          fetchEFFromDB: fetchEFFromTwoCategories,
          fetchElectricityEFFromDB,
        });
        setMeetingRecommendation(recMeeting);

        if (meeting.meetingType === 'online') {
          recordsToInsert.push({
            category_name: "การประชุม อบรม และจัดอีเวนต์",
            sub_category: "online",
            ef_id: meeting.ef_id || null,
            unit: "kWh",
            org_id: orgId,
            activity_name: meeting.meetingName,
            devices: meeting.devicesCount || 1,
            hours: meeting.durationHours,
            electricity_kwh: meeting.electricityKwh || 0,
            total_calculated: mTotal,
            equipment_name: "อุปกรณ์ประชุมออนไลน์",
          });
        } else {
          if (meeting.equipmentSets && meeting.equipmentSets.length > 0) {
            meeting.equipmentSets.forEach(set => {
              const setKWhTotal = set.devices * set.durationHours * set.electricityKwh;
              const setEmission = setKWhTotal * electricityEf;
              recordsToInsert.push({
                category_name: "การประชุม อบรม และจัดอีเวนต์",
                sub_category: "onsite_equipment",
                ef_id: meeting.ef_id || null,
                unit: "kWh",
                org_id: orgId,
                activity_name: meeting.meetingName,
                devices: set.devices,
                hours: set.durationHours,
                electricity_kwh: set.electricityKwh,
                total_calculated: Number(setEmission.toFixed(4)),
                equipment_name: set.equipmentName,
              });
            });
          }

          const travelPartEmission = res.breakdown?.travelEmission || 0;
          recordsToInsert.push({
            category_name: "การประชุม อบรม และจัดอีเวนต์",
            sub_category: "onsite_travel",
            ef_id: meeting.ef_id || null,
            unit: isMeetingEv ? 'kWh' : 'km',
            org_id: orgId,
            activity_name: `${meeting.meetingName} (การเดินทาง)`,
            trips: meeting.trips || 1,
            distance: meeting.distanceKm || 0,
            fuel_type: rawFuel.toLowerCase(),
            electricity_kwh: meeting.electricityKwh || null,
            total_calculated: travelPartEmission,
            equipment_name: `เดินทาง (${rawFuel})`,
          });
        }
      }

      // 2. หมวดการเดินทางทั่วไป (Travel)
      if (travel) {
        const isEv = travel.vehicleType.toLowerCase() === 'ev';
        const rawTravelFuel = isEv ? 'electricity' : (travel.fuelType || 'gasohol_e10');
        
        const dbEfValue = fetchEFFromTwoCategories(rawTravelFuel);

        if (dbEfValue === 0) {
          alert(`ไม่พบค่า Emission Factor สำหรับเชื้อเพลิง (${rawTravelFuel}) ในหมวด On-road vehicles หรือ Electricity กรุณาตรวจสอบการตั้งค่าของแอดมิน`);
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

        const res = executeCarbonCalculation(calcInput);
        tTotal = res.totalCalculated;
        setTravelRes(tTotal);

        const travelOptions: OptionType[] = [];
        Object.entries(VEHICLE_FUEL_MAPPINGS).forEach(([v, fuels]) => {
          fuels.forEach(f => {
            travelOptions.push({ subCategory: v, fuelType: f, name: `${v} (${f})` });
          });
        });

        const recTravel = getTravelRecommendations({
          currentEmission: tTotal,
          userInput: calcInput,
          allAvailableOptions: travelOptions,
          fetchEFFromDB: fetchEFFromTwoCategories,
        });
        setTravelRecommendation(recTravel);

        recordsToInsert.push({
          category_name: "การเดินทาง และขนส่ง",
          sub_category: travel.vehicleType.toLowerCase(),
          ef_id: travel.ef_id || null,
          unit: isEv ? 'kWh' : 'km',
          org_id: orgId,
          activity_name: travel.travelName,
          trips: travel.trips,
          distance: travel.distanceKm || null,
          fuel_type: rawTravelFuel.toLowerCase(),
          electricity_kwh: travel.electricityKwh || null,
          total_calculated: tTotal,
          equipment_name: null,
        });
      }

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
    // [MERGE-FIX] เดิมมี font-['Be_Vietnam_Pro'] แต่เว็บไม่ได้โหลดฟอนต์นี้ -> ทั้งหน้าแสดงเป็นฟอนต์สำรองของเครื่อง
    //   เอาออก ให้ใช้ฟอนต์หลักของเว็บ (font-sans) เหมือนหน้าอื่นทั้งฝั่ง organization และ admin
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 text-gray-800">
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
              บันทึกกิจกรรมการประชุมและการเดินทางขององค์กร ระบบรองรับการเพิ่มอุปกรณ์ไฟฟ้าหลายเซตสำหรับการประชุม Onsite และคำนวณตามมาตรฐาน CFO พร้อมคำแนะนำลดคาร์บอนอัตโนมัติ
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

          {/* ส่งข้อมูลการปล่อย (แปลงเป็นตันแล้วโดยหาร 1000) และข้อมูล Recommendation ไปยัง CalculationResult */}
          <CalculationResult
            meetingEmission={meetingRes / 1000}
            travelEmission={travelRes / 1000}
            resourceEmission={0}
            meetingRecommendation={meetingRecommendation}
            travelRecommendation={travelRecommendation}
          />
        </div>
      )}
    </div>
  );
}