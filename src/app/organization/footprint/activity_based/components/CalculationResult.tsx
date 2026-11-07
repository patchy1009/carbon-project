"use client";

import React from "react";

type CalculationResultProps = {
  meetingEmission: number;
  travelEmission: number;
  resourceEmission: number;
};

export default function CalculationResult({
  meetingEmission,
  travelEmission,
  resourceEmission,
}: CalculationResultProps) {
  const totalEmission = meetingEmission + travelEmission + resourceEmission;

  const formatEmission = (value: number) => {
    return Math.max(0, value).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              สรุปผลการประเมินคาร์บอนฟุตพริ้นท์องค์กร
            </h2>
            <p className="text-xs text-gray-500">
              แสดงปริมาณการปล่อยก๊าซเรือนกระจกจำแนกตามหมวดหมู่กิจกรรม
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* หมวดการประชุม */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-base">หมวดการประชุม (Meeting)</h3>
            <p className="text-xs text-gray-500 mt-0.5">คำนวณจากระยะเวลาและจำนวนผู้เข้าร่วม</p>
          </div>
          <div className="text-right">
            <span className="font-bold text-gray-900 text-lg">
              {formatEmission(meetingEmission)}{" "}
            </span>
            <span className="text-xs font-normal text-gray-500">kgCO₂e</span>
          </div>
        </div>

        {/* หมวดการเดินทาง */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-base">หมวดการเดินทาง (Travel)</h3>
            <p className="text-xs text-gray-500 mt-0.5">คำนวณจากระยะทาง เที่ยว และจำนวนผู้เดินทาง</p>
          </div>
          <div className="text-right">
            <span className="font-bold text-gray-900 text-lg">
              {formatEmission(travelEmission)}{" "}
            </span>
            <span className="text-xs font-normal text-gray-500">kgCO₂e</span>
          </div>
        </div>

        {/* หมวดทรัพยากรและพลังงาน */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-base">หมวดพลังงานและทรัพยากร (Resources)</h3>
            <p className="text-xs text-gray-500 mt-0.5">คำนวณจากปริมาณการใช้จริงตามหน่วยมาตรฐาน</p>
          </div>
          <div className="text-right">
            <span className="font-bold text-gray-900 text-lg">
              {formatEmission(resourceEmission)}{" "}
            </span>
            <span className="text-xs font-normal text-gray-500">kgCO₂e</span>
          </div>
        </div>

        {/* ยอดรวมทั้งหมด */}
        <div className="rounded-xl bg-green-50 p-5 border border-green-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-900">
              ปริมาณการปล่อยก๊าซเรือนกระจกรวมทั้งหมด
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              ยอดรวมสุทธิจากทุกกิจกรรมที่บันทึกในระบบ
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