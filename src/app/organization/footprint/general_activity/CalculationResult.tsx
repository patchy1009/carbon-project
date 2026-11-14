"use client";
/*
 * แสดงผลของหน้ากิจกรรมทั่วไป (TOR ข้อ 9.2, 9.3)
 *   1) สรุปปริมาณก๊าซเรือนกระจกของการประชุมและการเดินทาง + ยอดรวม (tCO2e) พร้อมไฟฟ้าที่ใช้และค่าไฟโดยประมาณ
 *   2) ข้อเสนอแนะลดคาร์บอน (ตัวเลือกที่ปล่อยน้อยกว่าที่ใช้อยู่)
 *   3) ปุ่มดาวน์โหลด PDF: ส่งตัวเลขที่แสดงอยู่ไปให้ ./pdf/route.tsx สร้างไฟล์ (ไม่อ่านฐานข้อมูลซ้ำ)
 */

import React, { useState } from "react";
import { ELECTRICITY_PRICE_BAHT_PER_KWH, vehicleLabel, GroupedVehicleRecommendation } from "./calculation";

// emission เป็นหน่วยตัน (tCO2e)  ค่าไฟเป็นบาท  ไฟฟ้าเป็น kWh
type CalculationResultProps = {
  meetingEmission: number;
  travelEmission: number;
  meetingRawElectricityKWh?: number;
  meetingElectricityCost?: number;
  travelRawElectricityKWh?: number;
  travelElectricityCost?: number;
  meetingRecommendation?: GroupedVehicleRecommendation[];
  travelRecommendation?: GroupedVehicleRecommendation[];
};

export default function CalculationResult({
  meetingEmission,
  travelEmission,
  meetingRawElectricityKWh = 0,
  meetingElectricityCost = 0,
  travelRawElectricityKWh = 0,
  travelElectricityCost = 0,
  meetingRecommendation = [],
  travelRecommendation = [],
}: CalculationResultProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfError, setPdfError] = useState(""); // ข้อความผิดพลาดตอนดาวน์โหลด PDF แสดงในหน้า (แทน popup)

  const totalEmission = meetingEmission + travelEmission;

  // กดดาวน์โหลด: ส่งข้อมูลที่แสดงอยู่ไป POST ที่ /pdf แล้วรับไฟล์ PDF กลับมาเป็นไฟล์ดาวน์โหลด
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    setPdfError("");
    try {
      const payload: CalculationResultProps = {
        meetingEmission,
        travelEmission,
        meetingRawElectricityKWh,
        meetingElectricityCost,
        travelRawElectricityKWh,
        travelElectricityCost,
        meetingRecommendation,
        travelRecommendation,
      };

      // ยิงตรงไปที่ Endpoint /pdf ใต้หน้าปัจจุบัน
      const endpoint = `${window.location.pathname.replace(/\/$/, "")}/pdf`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = "เกิดข้อผิดพลาดในการดาวน์โหลด PDF";
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
        } catch {
          // ตอบกลับไม่ใช่ JSON ก็ใช้ข้อความมาตรฐานด้านบน
        }
        setPdfError(errorMsg);
        return;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `General_Activity_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download Error:", error);
      setPdfError("ไม่สามารถเชื่อมต่อระบบดาวน์โหลด PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDownloading(false);
    }
  };

  const formatEmission = (value: number) => {
    return Math.max(0, value).toLocaleString("th-TH", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return Math.max(0, value).toLocaleString("th-TH", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // มีข้อเสนอแนะอย่างน้อย 1 ตัวเลือกที่ไม่ใช่แบบที่ใช้อยู่ -> แสดงส่วนข้อเสนอแนะ
  const hasMeetingRecs =
    meetingRecommendation &&
    meetingRecommendation.some((group) =>
      group.fuels.some((fuel) => !fuel.isCurrent)
    );
  const hasTravelRecs =
    travelRecommendation &&
    travelRecommendation.some((group) =>
      group.fuels.some((fuel) => !fuel.isCurrent)
    );
  const hasAnyValidRec = hasMeetingRecs || hasTravelRecs;

  return (
    <div className="space-y-6 text-gray-800">
      {/* ส่วนสรุปผลการประเมิน */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/70 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                สรุปผลการประเมินคาร์บอนฟุตพรินต์องค์กร
              </h2>
              <p className="text-xs text-gray-500">
                แสดงปริมาณการปล่อยก๊าซเรือนกระจกจำแนกตามหมวดหมู่กิจกรรม (หน่วย: ตันคาร์บอนไดออกไซด์เทียบเท่า)
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="flex items-center gap-2 rounded-xl bg-[#32885F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#286f4d] disabled:opacity-50"
          >
            {isDownloading ? (
              "กำลังสร้างไฟล์..."
            ) : (
              <>
                <span>📄</span>
                <span>ดาวน์โหลด PDF</span>
              </>
            )}
          </button>
        </div>

        {pdfError && (
          <div role="alert" className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span aria-hidden="true">⚠</span>
            <span>{pdfError}</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* หมวดการประชุม */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-800 text-base">
                หมวดการประชุม อบรม และจัดอีเวนต์
              </h3>

              {meetingRawElectricityKWh > 0 && (
                <div className="flex items-center gap-3 pt-1 text-xs text-gray-600 font-medium">
                  <span>
                    ปริมาณไฟฟ้า :{" "}
                    <strong className="text-gray-700">
                      {formatNumber(meetingRawElectricityKWh, 2)} kWh
                    </strong>
                  </span>
                  <span>
                    ค่าไฟโดยประมาณ ({ELECTRICITY_PRICE_BAHT_PER_KWH} บาท/kWh) :{" "}
                    <strong className="text-gray-700">
                      {formatNumber(meetingElectricityCost, 2)} บาท
                    </strong>
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-900 text-lg">
                {formatEmission(meetingEmission)}{" "}
              </span>
              <span className="text-xs font-normal text-gray-500">tCO₂e</span>
            </div>
          </div>

          {/* หมวดการเดินทาง */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-800 text-base">
                หมวดการเดินทาง
              </h3>

              {travelRawElectricityKWh > 0 && (
                <div className="flex items-center gap-3 pt-1 text-xs text-gray-600 font-medium">
                  <span>
                    ปริมาณไฟฟ้า :{" "}
                    <strong className="text-gray-700">
                      {formatNumber(travelRawElectricityKWh, 2)} kWh
                    </strong>
                  </span>
                  <span>
                    ค่าไฟโดยประมาณ ({ELECTRICITY_PRICE_BAHT_PER_KWH} บาท/kWh) :{" "}
                    <strong className="text-gray-700">
                      {formatNumber(travelElectricityCost, 2)} บาท
                    </strong>
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-900 text-lg">
                {formatEmission(travelEmission)}{" "}
              </span>
              <span className="text-xs font-normal text-gray-500">tCO₂e</span>
            </div>
          </div>

          {/* ยอดรวมทั้งหมด */}
          <div className="rounded-xl bg-emerald-50 p-5 border border-emerald-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-900">
                ปริมาณการปล่อยก๊าซเรือนกระจกรวมทั้งหมด
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
      {hasAnyValidRec && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                ข้อเสนอแนะเพื่อการลดการปล่อยก๊าซเรือนกระจก
              </h3>
              <p className="text-xs text-gray-500">
                แนวทางและเปรียบเทียบทางเลือกในการลดปริมาณการปล่อยคาร์บอนขององค์กร
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* 1. หมวดการประชุม */}
            {hasMeetingRecs && (
              <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-base font-bold text-gray-900">
                  หมวดการประชุม อบรม และจัดกิจกรรม
                </h4>

                <div className="space-y-4">
                  {meetingRecommendation.map((group, groupIdx) => {
                    const validFuels = group.fuels.filter(
                      (fuel) => !fuel.isCurrent
                    );
                    if (validFuels.length === 0) return null;

                    return (
                      <div
                        key={groupIdx}
                        className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                            รูปแบบ: {vehicleLabel(group.category_type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            ปล่อยน้อยที่สุดในกลุ่ม:{" "}
                            <strong className="text-emerald-700">
                              {formatEmission(group.bestEmissionTon)} tCO₂e
                            </strong>
                          </span>
                        </div>

                        <div className="space-y-2">
                          {validFuels.map((fuelItem, fuelIdx) => (
                            <div
                              key={fuelIdx}
                              className="p-3.5 rounded-xl border text-sm flex items-center justify-between bg-white border-gray-200"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 text-sm">
                                    {fuelItem.option.name}
                                  </span>
                                  {fuelIdx === 0 && (
                                    <span className="text-[10px] bg-[#32885F] text-white font-bold px-2 py-0.5 rounded-full">
                                      แนะนำที่สุด
                                    </span>
                                  )}
                                </div>

                                {(fuelItem.electricityReductionKWh !== undefined ||
                                  fuelItem.electricityCostSaved !== undefined) && (
                                  <div className="flex items-center gap-3 text-xs text-gray-600 pt-0.5">
                                    {fuelItem.electricityReductionKWh !== 0 && (
                                      <span className="text-emerald-700 font-medium">
                                        ไฟฟ้าลดลง:{" "}
                                        {formatNumber(
                                          fuelItem.electricityReductionKWh || 0,
                                          2
                                        )}{" "}
                                        kWh
                                      </span>
                                    )}
                                    {fuelItem.electricityCostSaved !== undefined &&
                                      fuelItem.electricityCostSaved !== 0 && (
                                        <span className="text-emerald-700 font-medium">
                                          ประหยัดค่าไฟโดยประมาณ:{" "}
                                          {formatNumber(
                                            fuelItem.electricityCostSaved,
                                            2
                                          )}{" "}
                                          บาท
                                        </span>
                                      )}
                                  </div>
                                )}
                              </div>

                              <div className="text-right space-y-0.5">
                                <div>
                                  <span className="text-base font-bold text-gray-900">
                                    {formatEmission(fuelItem.emissionTon)}{" "}
                                  </span>
                                  <span className="text-xs font-medium text-gray-500">
                                    tCO₂e
                                  </span>
                                </div>

                                {fuelItem.reductionTon > 0 ? (
                                  <div className="text-xs font-semibold text-emerald-600">
                                    ลดลง {formatEmission(fuelItem.reductionTon)} tCO₂e
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400">-</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. หมวดการเดินทาง */}
            {hasTravelRecs && (
              <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-base font-bold text-gray-900">
                  หมวดการเดินทาง
                </h4>

                <div className="space-y-4">
                  {travelRecommendation.map((group, groupIdx) => {
                    const validFuels = group.fuels.filter(
                      (fuel) => !fuel.isCurrent
                    );
                    if (validFuels.length === 0) return null;

                    return (
                      <div
                        key={groupIdx}
                        className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                            พาหนะ: {vehicleLabel(group.category_type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            ปล่อยน้อยที่สุดในกลุ่ม:{" "}
                            <strong className="text-emerald-700">
                              {formatEmission(group.bestEmissionTon)} tCO₂e
                            </strong>
                          </span>
                        </div>

                        <div className="space-y-2">
                          {validFuels.map((fuelItem, fuelIdx) => (
                            <div
                              key={fuelIdx}
                              className="p-3.5 rounded-xl border text-sm flex items-center justify-between bg-white border-gray-200"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 text-sm">
                                    {fuelItem.option.name}
                                  </span>
                                  {fuelIdx === 0 && (
                                    <span className="text-[10px] bg-[#32885F] text-white font-bold px-2 py-0.5 rounded-full">
                                      แนะนำที่สุด
                                    </span>
                                  )}
                                </div>

                                {(fuelItem.electricityReductionKWh !== undefined ||
                                  fuelItem.electricityCostSaved !== undefined) && (
                                  <div className="flex items-center gap-3 text-xs text-gray-600 pt-0.5">
                                    {fuelItem.electricityReductionKWh !== 0 && (
                                      <span className="text-emerald-700 font-medium">
                                        ไฟฟ้าลดลง:{" "}
                                        {formatNumber(
                                          fuelItem.electricityReductionKWh || 0,
                                          2
                                        )}{" "}
                                        kWh
                                      </span>
                                    )}
                                    {fuelItem.electricityCostSaved !== undefined &&
                                      fuelItem.electricityCostSaved !== 0 && (
                                        <span className="text-emerald-700 font-medium">
                                          ประหยัดค่าไฟโดยประมาณ:{" "}
                                          {formatNumber(
                                            fuelItem.electricityCostSaved,
                                            2
                                          )}{" "}
                                          บาท
                                        </span>
                                      )}
                                  </div>
                                )}
                              </div>

                              <div className="text-right space-y-0.5">
                                <div>
                                  <span className="text-base font-bold text-gray-900">
                                    {formatEmission(fuelItem.emissionTon)}{" "}
                                  </span>
                                  <span className="text-xs font-medium text-gray-500">
                                    tCO₂e
                                  </span>
                                </div>

                                {fuelItem.reductionTon > 0 ? (
                                  <div className="text-xs font-semibold text-emerald-600">
                                    ลดลง {formatEmission(fuelItem.reductionTon)} tCO₂e
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400">-</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}