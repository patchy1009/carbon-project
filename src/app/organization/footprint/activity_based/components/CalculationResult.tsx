"use client";

import React from "react";
import { Sparkles, TrendingDown } from "lucide-react";

type RecItem = {
  name: string;
  newEmissionTon?: number; 
  reductionTon?: number;
  isLowest?: boolean;
};

type CalculationResultProps = {
  meetingEmission: number; 
  travelEmission: number;  
  resourceEmission?: number;
  meetingRecommendation?: {
    best?: RecItem | null;
    runnerUp?: RecItem | null;
  } | null;
  travelRecommendation?: {
    best?: RecItem | null;
    runnerUp?: RecItem | null;
  } | null;
};

export default function CalculationResult({
  meetingEmission,
  travelEmission,
  resourceEmission = 0,
  meetingRecommendation,
  travelRecommendation,
}: CalculationResultProps) {
  const totalEmission = meetingEmission + travelEmission + resourceEmission;

  const formatEmission = (value: number) => {
    return Math.max(0, value).toLocaleString("th-TH", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const cleanName = (name: string) => {
    if (!name) return "";
    return name.replace(/^เปลี่ยนมาใช้\s*/i, "").trim();
  };

  const validMeetingBest = meetingRecommendation?.best && (meetingRecommendation.best.reductionTon || 0) > 0.0001;
  const validMeetingRunner = meetingRecommendation?.runnerUp && (meetingRecommendation.runnerUp.reductionTon || 0) > 0.0001;

  const validTravelBest = travelRecommendation?.best && (travelRecommendation.best.reductionTon || 0) > 0.0001;
  const validTravelRunner = travelRecommendation?.runnerUp && (travelRecommendation.runnerUp.reductionTon || 0) > 0.0001;

  const hasAnyValidRec = validMeetingBest || validMeetingRunner || validTravelBest || validTravelRunner;

  if (!hasAnyValidRec) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  สรุปผลการประเมินคาร์บอนฟุตพริ้นท์องค์กร
                </h2>
                <p className="text-xs text-gray-500">
                  แสดงปริมาณการปล่อยก๊าซเรือนกระจกจำแนกตามหมวดหมู่กิจกรรม (หน่วย: ตันคาร์บอนไดออกไซด์เทียบเท่า)
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-base">หมวดการประชุม อบรม และจัดอีเวนต์</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  คำนวณจากกิจกรรม Onsite/Online, พลังงานไฟฟ้า (kWh) และยานพาหนะเดินทาง
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900 text-lg">{formatEmission(meetingEmission)} </span>
                <span className="text-xs font-normal text-gray-500">tCO₂e</span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-base">หมวดการเดินทาง และขนส่ง</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  คำนวณจากระยะทาง เชื้อเพลิง หรือกระแสไฟฟ้าชาร์จรถยนต์ไฟฟ้า (EV)
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900 text-lg">{formatEmission(travelEmission)} </span>
                <span className="text-xs font-normal text-gray-500">tCO₂e</span>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 p-5 border border-emerald-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-900">ปริมาณการปล่อยก๊าซเรือนกระจกรวมทั้งหมด</p>
                <p className="text-xs text-emerald-700 mt-0.5">ยอดรวมสุทธิจากทุกกิจกรรมที่บันทึกในระบบ</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-emerald-900">{formatEmission(totalEmission)}</span>
                <span className="ml-1.5 text-sm font-medium text-emerald-800">tCO₂e</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ส่วนสรุปผลการประเมิน */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                สรุปผลการประเมินคาร์บอนฟุตพริ้นท์องค์กร
              </h2>
              <p className="text-xs text-gray-500">
                แสดงปริมาณการปล่อยก๊าซเรือนกระจกจำแนกตามหมวดหมู่กิจกรรม (หน่วย: ตันคาร์บอนไดออกไซด์เทียบเท่า)
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 text-base">
                หมวดการประชุม อบรม และจัดอีเวนต์
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                คำนวณจากกิจกรรม Onsite/Online, พลังงานไฟฟ้า (kWh) และยานพาหนะเดินทาง
              </p>
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-900 text-lg">
                {formatEmission(meetingEmission)}{" "}
              </span>
              <span className="text-xs font-normal text-gray-500">tCO₂e</span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 text-base">
                หมวดการเดินทาง และขนส่ง
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                คำนวณจากระยะทาง เชื้อเพลิง หรือกระแสไฟฟ้าชาร์จรถยนต์ไฟฟ้า (EV)
              </p>
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-900 text-lg">
                {formatEmission(travelEmission)}{" "}
              </span>
              <span className="text-xs font-normal text-gray-500">tCO₂e</span>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 p-5 border border-emerald-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-900">
                ปริมาณการปล่อยก๊าซเรือนกระจกรวมทั้งหมด
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                ยอดรวมสุทธิจากทุกกิจกรรมที่บันทึกในระบบ
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-emerald-900">
                {formatEmission(totalEmission)}
              </span>
              <span className="ml-1.5 text-sm font-medium text-emerald-800">
                tCO₂e
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ส่วนข้อเสนอแนะ */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">ข้อเสนอแนะเพื่อการลดการปล่อยก๊าซเรือนกระจก</h3>
            <p className="text-xs text-gray-500">แนวทางและเปรียบเทียบทางเลือกในการลดปริมาณการปล่อยคาร์บอนขององค์กร</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* 1. หมวดการประชุม */}
          {(validMeetingBest || validMeetingRunner) && (
            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
              <h4 className="text-base font-bold text-gray-900">หมวดการประชุม อบรม และจัดกิจกรรม</h4>

              <div className="space-y-3">
                {validMeetingBest && meetingRecommendation?.best && (() => {
                  const bestItem = meetingRecommendation.best;
                  const reductionTon = bestItem.reductionTon || 0;
                  const newEmissionTon = bestItem.newEmissionTon || 0;

                  return (
                    <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                          ★ แนะนำมากที่สุด
                        </span>
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <span className="text-xs text-gray-500">ลดลง</span>
                          <span className="text-xl font-bold">{formatEmission(reductionTon)} tCO₂e</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-800">
                        เปลี่ยนมาใช้: <strong className="text-gray-900">{cleanName(bestItem.name)}</strong>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-600">
                        ปล่อยคาร์บอน: <strong className="text-gray-900 font-semibold">{formatEmission(newEmissionTon)} tCO₂e</strong>
                      </div>
                    </div>
                  );
                })()}

                {validMeetingRunner && meetingRecommendation?.runnerUp && (() => {
                  const runnerItem = meetingRecommendation.runnerUp;
                  const reductionTon = runnerItem.reductionTon || 0;
                  const newEmissionTon = runnerItem.newEmissionTon || 0;

                  return (
                    <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                          แนะนำรองลงมา
                        </span>
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <span className="text-xs text-gray-500">ลดลง</span>
                          <span className="text-xl font-bold">{formatEmission(reductionTon)} tCO₂e</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-800">
                        เปลี่ยนมาใช้: <strong className="text-gray-900">{cleanName(runnerItem.name)}</strong>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-600">
                        ปล่อยคาร์บอน: <strong className="text-gray-900 font-semibold">{formatEmission(newEmissionTon)} tCO₂e</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 2. หมวดการเดินทาง */}
          {(validTravelBest || validTravelRunner) && (
            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
              <h4 className="text-base font-bold text-gray-900">หมวดการเดินทางและขนส่ง</h4>

              <div className="space-y-3">
                {validTravelBest && travelRecommendation?.best && (() => {
                  const bestItem = travelRecommendation.best;
                  const reductionTon = bestItem.reductionTon || 0;
                  const newEmissionTon = bestItem.newEmissionTon || 0;

                  return (
                    <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                          ★ แนะนำมากที่สุด
                        </span>
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <span className="text-xs text-gray-500">ลดลง</span>
                          <span className="text-xl font-bold">{formatEmission(reductionTon)} tCO₂e</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-800">
                        เปลี่ยนมาใช้: <strong className="text-gray-900">{cleanName(bestItem.name)}</strong>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-600">
                        ปล่อยคาร์บอน: <strong className="text-gray-900 font-semibold">{formatEmission(newEmissionTon)} tCO₂e</strong>
                      </div>
                    </div>
                  );
                })()}

                {validTravelRunner && travelRecommendation?.runnerUp && (() => {
                  const runnerItem = travelRecommendation.runnerUp;
                  const reductionTon = runnerItem.reductionTon || 0;
                  const newEmissionTon = runnerItem.newEmissionTon || 0;

                  return (
                    <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                          แนะนำรองลงมา
                        </span>
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <span className="text-xs text-gray-500">ลดลง</span>
                          <span className="text-xl font-bold">{formatEmission(reductionTon)} tCO₂e</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-800">
                        เปลี่ยนมาใช้: <strong className="text-gray-900">{cleanName(runnerItem.name)}</strong>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-600">
                        ปล่อยคาร์บอน: <strong className="text-gray-900 font-semibold">{formatEmission(newEmissionTon)} tCO₂e</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}