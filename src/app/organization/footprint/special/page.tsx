"use client";

import React, { useState } from "react";
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

const MOCK_EF = {
  electricity: 0.5,
  paper: 1.0,
  water: 0.3,
  fuel: 2.7,
  other: 0.1,
  travel: {
    car: 0.2,
    motorcycle: 0.1,
    van: 0.15,
    bus: 0.08,
    train: 0.05,
    airplane: 0.25,
    other: 0.1,
  },
};

export default function SpecialFootprintPage() {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);

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

  const handleCalculate = () => {
    // อนุญาตให้คำนวณได้หากกรอกข้อมูลอย่างน้อย 1 หมวด
    const hasMeeting = meeting !== null;
    const hasTravel = travel !== null;
    const hasResources = resources.length > 0;

    if (!hasMeeting && !hasTravel && !hasResources) {
      alert("กรุณากรอกข้อมูลอย่างน้อย 1 หมวดก่อนทำการคำนวณ");
      return;
    }
    setIsCalculated(true);
  };

  const meetingEmission = meeting
    ? calculateElectricityEmission(meeting.electricityKwh, MOCK_EF.electricity).emission
    : 0;

  const travelEF = MOCK_EF.travel[travel?.transportType as keyof typeof MOCK_EF.travel] ?? 0;

  const travelEmission = travel
    ? calculateTravelEmission(travel.distanceKm, travel.trips, travel.passengers, travelEF).emission
    : 0;

  const resourceEmission = resources.reduce((total, resource) => {
    const ef = MOCK_EF[resource.resourceName as keyof typeof MOCK_EF];
    if (typeof ef !== "number") return total;
    return total + calculateEmission(resource.amount, ef).emission;
  }, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      {/* หัวข้อหลักด้านบนสุด */}
      <h1 className="text-2xl font-bold text-gray-900">
        วิเคราะห์การปล่อยก๊าซเรือนกระจก
      </h1>

      {/* แถบแสดงขั้นตอน (Stepper) */}
      <FootprintStepper current={3} />

      {/* ฟอร์มกรอกข้อมูลทั้ง 3 ส่วน */}
      <MeetingForm onSubmit={handleMeetingSubmit} />
      <TravelForm onSubmit={handleTravelSubmit} />
      <ResourceForm onSubmit={handleResourceSubmit} />

      {/* ปุ่มคำนวณ */}
      <div>
        <button
          type="button"
          onClick={handleCalculate}
          className="rounded-xl bg-[#32885F] px-8 py-4 font-semibold text-white transition hover:bg-[#286e4d]"
        >
          คำนวณ Carbon Footprint โครงการพิเศษ
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
    </div>
  );
}