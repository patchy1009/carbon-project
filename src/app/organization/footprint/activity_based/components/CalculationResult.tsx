"use client";

import React from "react";
import { Sparkles, TrendingDown, CheckCircle2 } from "lucide-react";

type FuelOptionItem = {
  option: {
    subCategory: string;
    fuelType: string;
    name: string;
  };
  emissionTon: number;
  reductionTon: number;
  isCurrent: boolean;
};

type GroupedVehicleRecommendation = {
  subCategory: string;
  bestEmissionTon: number;
  fuels: FuelOptionItem[];
};

type CalculationResultProps = {
  meetingEmission: number; 
  travelEmission: number;   
  resourceEmission?: number;
  meetingRecommendation?: GroupedVehicleRecommendation[];
  travelRecommendation?: GroupedVehicleRecommendation[];
};

export default function CalculationResult({
  meetingEmission,
  travelEmission,
  resourceEmission = 0,
  meetingRecommendation = [],
  travelRecommendation = [],
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

  const hasMeetingRecs = meetingRecommendation && meetingRecommendation.length > 0;
  const hasTravelRecs = travelRecommendation && travelRecommendation.length > 0;
  const hasAnyValidRec = hasMeetingRecs || hasTravelRecs;

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

      {/* ส่วนข้อเสนอแนะ (แสดงผลแบบจัดกลุ่มชนิดรถ และเรียงลำดับเชื้อเพลิงย่อยข้างใน) */}
      {hasAnyValidRec && (
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
            {hasMeetingRecs && (
              <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-base font-bold text-gray-900">หมวดการประชุม อบรม และจัดกิจกรรม</h4>

                <div className="space-y-4">
                  {meetingRecommendation.map((group, groupIdx) => (
                    <div key={groupIdx} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                          ประเภท: {group.subCategory}
                        </span>
                        <span className="text-xs text-gray-500">
                          ปล่อยน้อยที่สุดในกลุ่ม: <strong className="text-emerald-700">{formatEmission(group.bestEmissionTon)} tCO₂e</strong>
                        </span>
                      </div>

                      {/* รายการเชื้อเพลิงย่อยภายในชนิดรถ (เรียงจากน้อยไปมาก) */}
                      <div className="space-y-2">
                        {group.fuels.map((fuelItem, fuelIdx) => (
                          <div 
                            key={fuelIdx} 
                            className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                              fuelItem.isCurrent 
                                ? "bg-emerald-50/60 border-emerald-300" 
                                : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{cleanName(fuelItem.option.name)}</span>
                                {fuelItem.isCurrent && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                    ตัวเลือกปัจจุบันของคุณ
                                  </span>
                                )}
                                {fuelIdx === 0 && groupIdx === 0 && (
                                  <span className="text-[10px] bg-[#32885F] text-white font-bold px-2 py-0.5 rounded-full">
                                    ★ แนะนำที่สุด
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                ปล่อยก๊าซ: <strong className="text-gray-800">{formatEmission(fuelItem.emissionTon)} tCO₂e</strong>
                              </p>
                            </div>

                            <div className="text-right">
                              {fuelItem.reductionTon > 0 ? (
                                <span className="text-xs font-semibold text-emerald-600">
                                  ลดลง {formatEmission(fuelItem.reductionTon)} tCO₂e
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  -
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. หมวดการเดินทาง */}
            {hasTravelRecs && (
              <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-base font-bold text-gray-900">หมวดการเดินทางและขนส่ง</h4>

                <div className="space-y-4">
                  {travelRecommendation.map((group, groupIdx) => (
                    <div key={groupIdx} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                          พาหนะ: {group.subCategory}
                        </span>
                        <span className="text-xs text-gray-500">
                          ปล่อยน้อยที่สุดในกลุ่ม: <strong className="text-emerald-700">{formatEmission(group.bestEmissionTon)} tCO₂e</strong>
                        </span>
                      </div>

                      {/* รายการเชื้อเพลิงย่อยภายในชนิดรถ (เรียงจากน้อยไปมาก) */}
                      <div className="space-y-2">
                        {group.fuels.map((fuelItem, fuelIdx) => (
                          <div 
                            key={fuelIdx} 
                            className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                              fuelItem.isCurrent 
                                ? "bg-emerald-50/60 border-emerald-300" 
                                : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{cleanName(fuelItem.option.name)}</span>
                                {fuelItem.isCurrent && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                    ตัวเลือกปัจจุบันของคุณ
                                  </span>
                                )}
                                {fuelIdx === 0 && groupIdx === 0 && (
                                  <span className="text-[10px] bg-[#32885F] text-white font-bold px-2 py-0.5 rounded-full">
                                    ★ แนะนำที่สุด
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                ปล่อยก๊าซ: <strong className="text-gray-800">{formatEmission(fuelItem.emissionTon)} tCO₂e</strong>
                              </p>
                            </div>

                            <div className="text-right">
                              {fuelItem.reductionTon > 0 ? (
                                <span className="text-xs font-semibold text-emerald-600">
                                  ลดลง {formatEmission(fuelItem.reductionTon)} tCO₂e
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  -
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}