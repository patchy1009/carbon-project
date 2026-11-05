"use client";

import React from "react";
import { MeetingData } from "./MeetingForm";
import { TravelData } from "./TravelForm";
import { ResourceData } from "./ResourceForm";

type CalculationResultProps = {
  meetingEmission: number;
  travelEmission: number;
  resourceEmission: number;
  meetingData?: MeetingData | null;
  travelData?: TravelData | null;
  resourceData?: ResourceData[];
};

export default function CalculationResult({
  meetingEmission,
  travelEmission,
  resourceEmission,
  meetingData,
  travelData,
  resourceData = [],
}: CalculationResultProps) {
  const totalEmission = meetingEmission + travelEmission + resourceEmission;

  const formatEmission = (value: number) => {
    return Math.max(0, value).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // 1. คำนวณการประชุม
  let meetingProjected = 0;
  let meetingDiff = 0;
  const isMeetingOnsite = meetingData?.meetingType === "onsite";

  if (meetingData) {
    if (isMeetingOnsite) {
      const onlineElectricity = meetingData.participants * meetingData.durationHours * 0.05;
      meetingProjected = onlineElectricity * 0.5;
    } else {
      meetingProjected = meetingEmission * 0.2;
    }
    meetingDiff = Math.max(0, meetingEmission - meetingProjected);
  } else {
    meetingDiff = meetingEmission * 0.4;
    meetingProjected = Math.max(0, meetingEmission - meetingDiff);
  }

  // 2. คำนวณการเดินทาง
  let travelProjected = 0;
  let travelDiff = 0;

  if (travelData) {
    const totalDistance = travelData.distanceKm * travelData.trips * travelData.passengers;
    const trainEF = 0.05; 
    travelProjected = totalDistance * trainEF;
    travelDiff = Math.max(0, travelEmission - travelProjected);
  } else {
    travelDiff = travelEmission * 0.5;
    travelProjected = Math.max(0, travelEmission - travelDiff);
  }

  // 3. คำนวณทรัพยากร
  const resourceDiff = resourceEmission * 0.3;
  const resourceProjected = resourceEmission - resourceDiff;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header การ์ด */}
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              สรุปผลการคำนวณและข้อเสนอแนะในการลด
            </h2>
            <p className="text-xs text-gray-500">
              เปรียบเทียบปริมาณการปล่อยก๊าซเรือนกระจกปัจจุบันกับแนวทางปรับเปลี่ยนพฤติกรรม
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* หมวด Meeting */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-semibold text-gray-800 text-base">
              Meeting (การประชุม)
            </h3>
            <div className="text-right">
              <span className="text-xs text-gray-400 block">ปล่อยปัจจุบัน</span>
              <span className="font-bold text-gray-900 text-base">
                {formatEmission(meetingEmission)}{" "}
                <span className="text-xs font-normal text-gray-500">kgCO₂e</span>
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
            <div className="text-gray-700">
              <span className="text-gray-400 mr-2">แนวทางลด:</span>
              <span className="font-medium">
                {isMeetingOnsite
                  ? "เปลี่ยนการประชุมเป็นรูปแบบ Online เต็มรูปแบบ"
                  : "รักษาระดับการประชุม Online เพื่อคงประสิทธิภาพการประหยัดพลังงาน"}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm border-t sm:border-t-0 border-gray-200 pt-2 sm:pt-0">
              <div className="text-gray-600">
                ปล่อยเหลือ:{" "}
                <strong className="text-gray-900">
                  {formatEmission(meetingProjected)}
                </strong>
              </div>
              {/* ภาพที่ 1: ถอดกรอบเขียวออก เหลือแค่ฟ้อนสีเขียว */}
              <div className="font-bold text-[#32885F]">
                ลดลง -{formatEmission(meetingDiff)} kgCO₂e
              </div>
            </div>
          </div>
        </div>

        {/* หมวด Travel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-semibold text-gray-800 text-base">
              Travel (การเดินทาง)
            </h3>
            <div className="text-right">
              <span className="text-xs text-gray-400 block">ปล่อยปัจจุบัน</span>
              <span className="font-bold text-gray-900 text-base">
                {formatEmission(travelEmission)}{" "}
                <span className="text-xs font-normal text-gray-500">kgCO₂e</span>
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
            <div className="text-gray-700">
              <span className="text-gray-400 mr-2">แนวทางลด:</span>
              <span className="font-medium">
                เปลี่ยนการเดินทางเป็นรถไฟหรือรถสาธารณะ
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm border-t sm:border-t-0 border-gray-200 pt-2 sm:pt-0">
              <div className="text-gray-600">
                ปล่อยเหลือ:{" "}
                <strong className="text-gray-900">
                  {formatEmission(travelProjected)}
                </strong>
              </div>
              {/* ภาพที่ 1: ถอดกรอบเขียวออก เหลือแค่ฟ้อนสีเขียว */}
              <div className="font-bold text-[#32885F]">
                ลดลง -{formatEmission(travelDiff)} kgCO₂e
              </div>
            </div>
          </div>
        </div>

        {/* หมวด Office Resources */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-semibold text-gray-800 text-base">
              Office Resources (ทรัพยากร)
            </h3>
            <div className="text-right">
              <span className="text-xs text-gray-400 block">ปล่อยปัจจุบัน</span>
              <span className="font-bold text-gray-900 text-base">
                {formatEmission(resourceEmission)}{" "}
                <span className="text-xs font-normal text-gray-500">kgCO₂e</span>
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
            <div className="text-gray-700">
              <span className="text-gray-400 mr-2">แนวทางลด:</span>
              <span className="font-medium">
                ปรับใช้มาตรการ Paperless และประหยัดการใช้พลังงาน
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm border-t sm:border-t-0 border-gray-200 pt-2 sm:pt-0">
              <div className="text-gray-600">
                ปล่อยเหลือ:{" "}
                <strong className="text-gray-900">
                  {formatEmission(resourceProjected)}
                </strong>
              </div>
              {/* ภาพที่ 1: ถอดกรอบเขียวออก เหลือแค่ฟ้อนสีเขียว */}
              <div className="font-bold text-[#32885F]">
                ลดลง -{formatEmission(resourceDiff)} kgCO₂e
              </div>
            </div>
          </div>
        </div>

        {/* ภาพที่ 2: ยอดรวมทั้งหมด (คืนค่ากรอบสีเขียวอ่อนแบบเดิม) */}
        <div className="rounded-xl bg-green-50 p-5 border border-green-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-900">
              ปริมาณการปล่อยก๊าซเรือนกระจกรวมทั้งหมด
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              คำนวณจากทุกกิจกรรมที่กรอกข้อมูล
            </p>
          </div>

          <div className="text-right">
            <span className="text-3xl font-bold text-green-900">
              {formatEmission(totalEmission)}
            </span>
            <span className="ml-1.5 text-sm font-medium text-green-800">
              kgCO₂e
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}