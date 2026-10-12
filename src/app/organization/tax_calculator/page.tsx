"use client";

import React, { useState, useEffect } from "react";

// ============================================================================
// Mock Data: จำลองข้อมูลโครงการ T-VER ที่ผู้ใช้เลือกจากหน้า "จำลองโครงการ T-VER"
// ============================================================================
interface TVerProjectSimulationData {
  id: string;
  projectName: string;
  ratioSell: number;          // Ratio_Sell = 50% (0.50) ตามค่าทดลอง
  expenseRatio: number;       // Expenses Ratio = 20% (0.20) Standard Default
  defaultCarbonPrice: number; // Price_Credit (บาท/tCO2e)
  cSeqYear1: number;          // C_SEQ ปีที่ 1
  cSeqYear2: number;          // C_SEQ ปีที่ 2
  cSeqYear3: number;          // C_SEQ ปีที่ 3
}

const mockSimulatedProjects: TVerProjectSimulationData[] = [
  {
    id: "proj-001",
    projectName: "โครงการปลูกป่าสัก ที่ราบสูงตอนเหนือ",
    ratioSell: 0.50, //ปรับเป็น 50% ตามค่าทดลอง
    expenseRatio: 0.20, //ค่าใช้จ่าย 20% Standard Default

    defaultCarbonPrice: 250,
    cSeqYear1: 1250,
    cSeqYear2: 1475,
    cSeqYear3: 1725,
  },
  {
    id: "proj-002",
    projectName: "โครงการฟื้นฟูป่าชุมชนภาคอีสาน",
    ratioSell: 0.50,
    expenseRatio: 0.20,
    defaultCarbonPrice: 280,
    cSeqYear1: 8000,
    cSeqYear2: 9500,
    cSeqYear3: 11000,
  },
  {
    id: "proj-003",
    projectName: "โครงการพลังงานชีวมวลภาคกลาง",
    ratioSell: 0.50,
    expenseRatio: 0.20,
    defaultCarbonPrice: 300,
    cSeqYear1: 20000,
    cSeqYear2: 20000,
    cSeqYear3: 20000,
  },
];

const taxBenefitOptions = [
  { label: "ยกเว้นภาษีเงินได้นิติบุคคล (1 ปี)", years: 1 },
  { label: "ยกเว้นภาษีเงินได้นิติบุคคล (2 ปี)", years: 2 },
  { label: "ยกเว้นภาษีเงินได้นิติบุคคล (3 ปี)", years: 3 },
];

export default function TaxCalculatorPage() {
  // ----------------------------------------------------
  // 1. STATE สำหรับโครงการที่เลือก
  // ----------------------------------------------------
  const [selectedProjectId, setSelectedProjectId] = useState<string>(mockSimulatedProjects[0].id);
  const [activeProject, setActiveProject] = useState<TVerProjectSimulationData>(mockSimulatedProjects[0]);

  // States สำหรับ Form (Auto-filled เมื่อเปลี่ยนโครงการ)
  const [cSeqYear1, setCSeqYear1] = useState<number | "">(mockSimulatedProjects[0].cSeqYear1);
  const [cSeqYear2, setCSeqYear2] = useState<number | "">(mockSimulatedProjects[0].cSeqYear2);
  const [cSeqYear3, setCSeqYear3] = useState<number | "">(mockSimulatedProjects[0].cSeqYear3);
  const [carbonPrice, setCarbonPrice] = useState<number | "">(mockSimulatedProjects[0].defaultCarbonPrice);
  const [selectedTaxBenefitYears, setSelectedTaxBenefitYears] = useState<number>(3);

  // ----------------------------------------------------
  // 2. STATE สำหรับผลลัพธ์การคำนวณ
  // ----------------------------------------------------
  const [isCalculated, setIsCalculated] = useState(false);
  const [calculationResult, setCalculationResult] = useState<{
    creditSold: number;
    revenueTVer: number;
    expensesTVer: number;
    profitTVer: number;
    taxExemptYearly: number;
    grossProfitMargin: number;
    selectedYears: number;
    tableColumns: Array<{
      yearLabel: string;
      revenue: number;
      netProfit: number;
      normalTax: number;
      exemptTax: number;
    }>;
  } | null>(null);

  // ----------------------------------------------------
  // 3. EFFECT: เมื่อเปลี่ยนโครงการ ให้ Auto-fill ข้อมูลใหม่ทันที
  // ----------------------------------------------------
  useEffect(() => {
    const proj = mockSimulatedProjects.find((p) => p.id === selectedProjectId);
    if (proj) {
      setActiveProject(proj);
      setCSeqYear1(proj.cSeqYear1);
      setCSeqYear2(proj.cSeqYear2);
      setCSeqYear3(proj.cSeqYear3);
      setCarbonPrice(proj.defaultCarbonPrice);
      setIsCalculated(false);
    }
  }, [selectedProjectId]);

  // ----------------------------------------------------
  // 4. ฟังก์ชันคำนวณภาษี (ใช้ Ratio_Sell = 50% และ Expense = 20%)
  // ----------------------------------------------------
  const handleCalculateTax = (e: React.FormEvent) => {
    e.preventDefault();

    const priceCredit = Number(carbonPrice) || 0;
    
    // สัดส่วนจากการทดลองและมาตรฐานกฎหมาย
    const ratioSell = activeProject.ratioSell;       // 50% (0.50)
    const expenseRatio = activeProject.expenseRatio; // 20% (0.20)
    const citRate = 0.20;                            // CIT Rate 20%

    const yearlyCSeqList = [
      Number(cSeqYear1) || 0,
      Number(cSeqYear2) || 0,
      Number(cSeqYear3) || 0,
    ];

    const yearLabels = ["ปัจจุบัน", "ปีที่ 2 (คาดการณ์)", "ปีที่ 3 (คาดการณ์)"];

    const allYearsCalculatedData = yearLabels.map((label, index) => {
      const cSeq = yearlyCSeqList[index];

      // === สูตรที่ 8: Revenue_T-VER ===
      // Credit_Sold = C_SEQ * Ratio_Sell (50%)
      const creditSold = cSeq * ratioSell;
      const rev = creditSold * priceCredit;

      // === สูตรที่ 7: Profit_T-VER = Revenue - Expenses ===
      const expenses = rev * expenseRatio;
      const profit = rev - expenses;

      // === สูตรที่ 9: Tax_Exempt = Profit * CIT_Rate (20%) ===
      const normalTax = profit * citRate;
      const exemptTax = profit * citRate;

      return {
        yearLabel: label,
        revenue: rev,
        netProfit: profit,
        normalTax: normalTax,
        exemptTax: exemptTax,
      };
    });

    // ค่าปีที่ 1 สำหรับแสดงบนการ์ดสรุปฝั่งขวา
    const year1CSeq = Number(cSeqYear1) || 0;
    const year1CreditSold = year1CSeq * ratioSell;
    const year1Revenue = year1CreditSold * priceCredit;
    const year1Expenses = year1Revenue * expenseRatio;
    const year1Profit = year1Revenue - year1Expenses;

    const selectedColumns = allYearsCalculatedData.slice(0, selectedTaxBenefitYears);

    setCalculationResult({
      creditSold: year1CreditSold,
      revenueTVer: year1Revenue,
      expensesTVer: year1Expenses,
      profitTVer: year1Profit,
      taxExemptYearly: year1Profit * citRate,
      grossProfitMargin: Number(((1 - expenseRatio) * 100).toFixed(1)), // 80%
      selectedYears: selectedTaxBenefitYears,
      tableColumns: selectedColumns,
    });

    setIsCalculated(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-8 text-slate-800">
      {/* HEADINGS SECTION */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#11221C]">
          ประเมินการยกเว้นภาษี
        </h1>
        <p className="text-xs md:text-sm text-slate-500 font-medium">
          วิเคราะห์ความคุ้มค่าทางการเงินจากการลดการปล่อยก๊าซเรือนกระจกและสิทธิประโยชน์ทางภาษี
        </p>
      </div>

      {/* MAIN CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ========================================================= */}
        {/* ฝั่งซ้าย: ฟอร์มตั้งค่าการประเมิน */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-[#11221C]">ตั้งค่าการประเมิน</h2>

          <form onSubmit={handleCalculateTax} className="space-y-4">
            {/* ดรอปดาวน์เลือกโครงการ */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">
                โครงการที่เลือกประเมิน
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 font-semibold bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600 appearance-none cursor-pointer"
              >
                {mockSimulatedProjects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.projectName}
                  </option>
                ))}
              </select>
            </div>

            {/* คาร์บอนฟุตพริ้นท์แยก 3 ปี */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="text-xs font-bold text-slate-700 block">
                คาร์บอนฟุตพริ้นท์ (tCO2e/ปี)
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 1</span>
                  <input
                    type="number"
                    value={cSeqYear1}
                    onChange={(e) => setCSeqYear1(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 2</span>
                  <input
                    type="number"
                    value={cSeqYear2}
                    onChange={(e) => setCSeqYear2(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 3</span>
                  <input
                    type="number"
                    value={cSeqYear3}
                    onChange={(e) => setCSeqYear3(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Price_Credit */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">
                ราคาคาร์บอนเครดิต (บาท/tCO2e)
              </label>
              <input
                type="number"
                value={carbonPrice}
                onChange={(e) =>
                  setCarbonPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* สิทธิประโยชน์ภาษี (1-3 ปี) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">สิทธิประโยชน์</label>
              <select
                value={selectedTaxBenefitYears}
                onChange={(e) => setSelectedTaxBenefitYears(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 font-semibold bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600 appearance-none cursor-pointer"
              >
                {taxBenefitOptions.map((opt) => (
                  <option key={opt.years} value={opt.years}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-[#2C7A59] hover:bg-[#1f5a41] text-white font-bold rounded-2xl text-xs transition shadow-md cursor-pointer"
              >
                คำนวณภาษี
              </button>
            </div>
          </form>
        </div>

        {/* ========================================================= */}
        {/* ฝั่งขวา: แสดงผล UI ต้นฉบับเหมือนเดิมทุกประการ */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {isCalculated && calculationResult ? (
            <>
              {/* ตารางแสดงผลภาษี */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-bold border-b border-slate-100 pb-3">
                      <th className="py-3 px-2">รายการ</th>
                      {calculationResult.tableColumns.map((col, idx) => (
                        <th key={idx} className="py-3 px-2 text-right">
                          {col.yearLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                    {/* Revenue_T-VER */}
                    <tr>
                      <td className="py-3.5 px-2 font-bold text-slate-800">
                        รายได้ (Revenue)
                      </td>
                      {calculationResult.tableColumns.map((col, idx) => (
                        <td key={idx} className="py-3.5 px-2 text-right">
                          {col.revenue.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      ))}
                    </tr>

                    {/* Profit_T-VER */}
                    <tr>
                      <td className="py-3.5 px-2 font-bold text-slate-800">
                        กำไรสุทธิ (Net Profit)
                      </td>
                      {calculationResult.tableColumns.map((col, idx) => (
                        <td key={idx} className="py-3.5 px-2 text-right">
                          {col.netProfit.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      ))}
                    </tr>

                    {/* ภาษีปกติ (20%) */}
                    <tr>
                      <td className="py-3.5 px-2 font-bold text-slate-800">
                        ภาษีที่ต้องชำระปกติ (20%)
                      </td>
                      {calculationResult.tableColumns.map((col, idx) => (
                        <td key={idx} className="py-3.5 px-2 text-right">
                          {col.normalTax.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      ))}
                    </tr>

                    {/* Tax_Exempt */}
                    <tr className="bg-emerald-50/60 rounded-2xl text-emerald-800 font-bold">
                      <td className="py-3.5 px-3 rounded-l-2xl">
                        ภาษีที่ได้รับการยกเว้น
                      </td>
                      {calculationResult.tableColumns.map((col, idx) => (
                        <td
                          key={idx}
                          className={`py-3.5 px-2 text-right ${
                            idx === calculationResult.tableColumns.length - 1
                              ? "rounded-r-2xl pr-3"
                              : ""
                          }`}
                        >
                          {col.exemptTax.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* การ์ดสรุปรายละเอียดการคำนวณตาม UI ต้นฉบับ */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-[#11221C]">
                  รายละเอียดการคำนวณ (สิทธิประโยชน์ {calculationResult.selectedYears} รอบบัญชี)
                </h3>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">สัดส่วนคาร์บอนที่ลดได้ (Credit_Sold)</span>
                    <span className="font-extrabold text-slate-800">
                      {calculationResult.creditSold.toLocaleString("th-TH", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      tCO2e
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">มูลค่าคาร์บอนเครดิตชดเชย (Revenue_T-VER)</span>
                    <span className="font-extrabold text-slate-800">
                      ฿{" "}
                      {calculationResult.revenueTVer.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl h-64 flex items-center justify-center text-slate-400 text-xs font-medium">
              กรอกข้อมูลการประเมินฝั่งซ้าย แล้วกด "คำนวณภาษี" เพื่อดูผลลัพธ์
            </div>
          )}
        </div>
      </div>
    </div>
  );
}