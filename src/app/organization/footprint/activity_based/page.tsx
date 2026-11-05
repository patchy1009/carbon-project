"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import MeetingForm, { MeetingData } from "./components/MeetingForm";
import TravelForm, { TravelData } from "./components/TravelForm";
import ResourceForm, { ResourceData } from "./components/ResourceForm";
import CalculationResult from "./components/CalculationResult";
import {
  calculateElectricityEmission,
  calculateTravelEmission,
  calculateEmission,
} from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";

export default function ActivityBasedFootprintPage() {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State สำหรับเก็บรายการรายละเอียดและค่า EF ที่ดึงมาจากฐานข้อมูลกลางของแอดมิน
  const [adminDetails, setAdminDetails] = useState<any[]>([]);
  const [loadingEF, setLoadingEF] = useState(true);

  // ดึงข้อมูลค่า EF จริงจากฐานข้อมูลกลาง (ตาราง activity_detail และ emission_factor)
  useEffect(() => {
    async function fetchAdminActivityDetails() {
      try {
        const { data, error } = await supabase
          .from('activity_detail')
          .select('*, activity(activity_id, activity_name, scope_id), emission_factor(ef_id, ef_name, ef_value, real_unit)');
        
        if (error) throw error;
        if (data) {
          setAdminDetails(data);
        }
      } catch (err) {
        console.error("ไม่สามารถดึงข้อมูลค่า EF จากฐานข้อมูลได้:", err);
      } finally {
        setLoadingEF(false);
      }
    }

    fetchAdminActivityDetails();
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

  // 1. คำนวณค่าคาร์บอนจากการประชุม (ใช้ .totalCalculated)
  const electricityDetail = adminDetails.find(d => 
    d.detail_name?.toLowerCase().includes('ไฟฟ้า') || d.unit?.toLowerCase() === 'kwh'
  );
  const electricityEF = electricityDetail?.emission_factor?.ef_value ?? 0.5;

  const meetingEmission = meeting
    ? calculateElectricityEmission(meeting.electricityKwh, electricityEF).totalCalculated
    : 0;

  // 2. คำนวณค่าคาร์บอนจากการเดินทาง (ใช้ .totalCalculated)
  const travelDetail = adminDetails.find(d => 
    d.detail_name?.toLowerCase().includes(travel?.transportType?.toLowerCase() || '')
  );
  const travelEF = travelDetail?.emission_factor?.ef_value ?? 0.2;

  const travelEmission = travel
    ? calculateTravelEmission(travel.distanceKm, travel.trips, travel.passengers, travelEF).totalCalculated
    : 0;

  // 3. คำนวณค่าคาร์บอนจากทรัพยากรอื่นๆ (ใช้ .totalCalculated)
  const resourceEmission = resources.reduce((total, resource) => {
    const resDetail = adminDetails.find(d => 
      d.detail_name?.toLowerCase().includes(resource.resourceName.toLowerCase())
    );
    const ef = resDetail?.emission_factor?.ef_value ?? 0.1;
    return total + calculateEmission(resource.amount, ef).totalCalculated;
  }, 0);

  // ฟังก์ชันคำนวณและบันทึกข้อมูลลงตารางฝั่งองค์กร
  const handleCalculateAndSave = async () => {
    const hasMeeting = meeting !== null;
    const hasTravel = travel !== null;
    const hasResources = resources.length > 0;

    if (!hasMeeting && !hasTravel && !hasResources) {
      alert("กรุณากรอกข้อมูลอย่างน้อย 1 หมวดก่อนทำการคำนวณ");
      return;
    }

    setIsCalculated(true);
    setIsSaving(true);

    try {
      const orgId = "YOUR_ORG_UUID_HERE"; // แทนที่ด้วยรหัสองค์กรจริงจาก Auth / Session
      const recordsToInsert = [];

      if (meeting && electricityDetail) {
        recordsToInsert.push({
          org_id: orgId,
          categoryact_id: electricityDetail.activity_id,
          activity_name: "กิจกรรมการประชุม",
          unit: electricityDetail.unit || "kWh",
          fuel: null,
          water: null,
          total_calculated: meetingEmission,
        });
      }

      if (travel && travelDetail) {
        recordsToInsert.push({
          org_id: orgId,
          categoryact_id: travelDetail.activity_id,
          activity_name: `เดินทางด้วย ${travel.transportType}`,
          unit: travelDetail.unit || "km",
          fuel: travel.distanceKm,
          water: null,
          total_calculated: travelEmission,
        });
      }

      if (recordsToInsert.length > 0) {
        const { error } = await supabase
          .from('general_category_activity_detail')
          .insert(recordsToInsert);

        if (error) throw error;
        alert("คำนวณและบันทึกข้อมูลลงฐานข้อมูลสำเร็จ!");
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการบันทึก:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      {/* หัวข้อหลักด้านบนสุด */}
      <h1 className="text-2xl font-bold text-gray-900">
        วิเคราะห์การปล่อยก๊าซเรือนกระจก
      </h1>

      {/* แถบแสดงขั้นตอน (Stepper) */}
      <FootprintStepper current={3} />

      {loadingEF ? (
        <div className="text-center py-8 text-gray-500 font-['Be_Vietnam_Pro']">
          กำลังโหลดข้อมูลค่า Emission Factor จากระบบกลาง...
        </div>
      ) : (
        <>
          {/* ฟอร์มกรอกข้อมูลทั้ง 3 ส่วน */}
          <MeetingForm onSubmit={handleMeetingSubmit} />
          <TravelForm onSubmit={handleTravelSubmit} />
          <ResourceForm onSubmit={handleResourceSubmit} />

          {/* ปุ่มคำนวณและบันทึก */}
          <div>
            <button
              type="button"
              onClick={handleCalculateAndSave}
              disabled={isSaving}
              className="rounded-xl bg-[#32885F] px-8 py-4 font-semibold text-white transition hover:bg-[#286e4d] disabled:opacity-50"
            >
              {isSaving ? "กำลังบันทึกข้อมูล..." : "คำนวณ Carbon Footprint โครงการพิเศษ"}
            </button>
          </div>

          {/* ผลลัพธ์การคำนวณ */}
          {isCalculated && (
            <CalculationResult
              meetingEmission={meetingEmission}
              travelEmission={travelEmission}
              resourceEmission={resourceEmission}
            />
          )}
        </>
      )}
    </div>
  );
}