"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const taxBenefitOptions = [
  { label: "ยกเว้นภาษีเงินได้นิติบุคคล 1 ปี", years: 1 },
  { label: "ยกเว้นภาษีเงินได้นิติบุคคล 2 ปี", years: 2 },
  { label: "ยกเว้นภาษีเงินได้นิติบุคคล 3 ปี", years: 3 },
];

export default function TaxCalculatorPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // ค่าตั้งค่าสำหรับการคำนวณ
  const [ratioSell, setRatioSell] = useState<number>(50); // Dropdown 50 หรือ 80
  const [carbonPrice, setCarbonPrice] = useState<number | "">(250); // ราคาขาย (บาท/tCO2e)

  // ค่าใช้จ่ายตรงของโครงการ (Expenses_T-VER) ที่ผู้ใช้กรอกเองแยกตาม 3 ปี
  const [expenseYear1, setExpenseYear1] = useState<number | "">(25000);
  const [expenseYear2, setExpenseYear2] = useState<number | "">(28000);
  const [expenseYear3, setExpenseYear3] = useState<number | "">(30000);

  const [selectedTaxBenefitYears, setSelectedTaxBenefitYears] = useState<number>(3);

  // ผลลัพธ์การคำนวณ
  const [isCalculated, setIsCalculated] = useState(false);
  const [calculationResult, setCalculationResult] = useState<{
    projectName: string;
    creditSold: number;
    revenueTVer: number;
    expensesTVer: number;
    profitTVer: number;
    taxExemptYearly: number;
    selectedYears: number;
    tableColumns: Array<{
      yearLabel: string;
      revenue: number;
      expenses: number;
      netProfit: number;
      normalTax: number;
      exemptTax: number;
    }>;
  } | null>(null);

  // โหลดข้อมูลโครงการป่าไม้ตามโครงสร้าง Proposal ที่เชื่อมโยงผ่าน organization -> org_tree_project -> org_credit_allocation
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        let currentOrgId = null;

        // 1. ค้นหา organization ของผู้ใช้ปัจจุบัน
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: orgData } = await supabase
            .from("organization")
            .select("org_id")
            .eq("acc_id", authData.user.id)
            .maybeSingle();

          if (orgData) {
            currentOrgId = orgData.org_id;
          }
        }

        // หากไม่เจอตาม acc_id ให้ดึงองค์กรแรกในระบบเป็น Fallback
        if (!currentOrgId) {
          const { data: fallbackOrg } = await supabase
            .from("organization")
            .select("org_id")
            .limit(1)
            .maybeSingle();

          if (fallbackOrg) {
            currentOrgId = fallbackOrg.org_id;
          }
        }

        if (!currentOrgId) {
          setLoadingProjects(false);
          return;
        }

        // 2. ดึงข้อมูลโครงการปลูกป่า (org_tree_project) และเชื่อมตารางจัดสรร (org_credit_allocation) ตาม Proposal
        const { data: projectData, error: projError } = await supabase
          .from("org_tree_project")
          .select(`
            orgtreeproject_id,
            project_name,
            join_year,
            credit_year_1,
            credit_year_2,
            credit_year_3,
            org_credit_allocation (
              orgallocate_id,
              total_credit,
              offset_credit,
              remaining_credit
            )
          `)
          .eq("org_id", currentOrgId);

        if (projError) throw projError;

        if (projectData && projectData.length > 0) {
          setProjects(projectData);
          const firstProjId = projectData[0].orgtreeproject_id;
          setSelectedProjectId(firstProjId);
        }
      } catch (err) {
        console.error("Error loading projects from database:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  // ค้นหาโครงการที่ถูกเลือกปัจจุบัน (รองรับทั้ง orgtreeproject_id และ id)
  const selectedProject = projects.find(
    (p) => (p.orgtreeproject_id || p.id) === selectedProjectId
  );

  // ฟังก์ชันคำนวณภาษีตามสูตรใน Proposal (สูตรที่ 7, 8, 9)
  const handleCalculateTax = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProject) {
      alert("กรุณาเลือกโครงการป่าไม้ก่อนคำนวณ");
      return;
    }

    const priceCredit = Number(carbonPrice) || 0;
    const sellRatioDecimal = Number(ratioSell) / 100; // แปลง 50 หรือ 80 เป็นทศนิยม
    const citRate = 0.20; // อัตราภาษีเงินได้นิติบุคคล 20%

    // ดึงค่า C_SEQ รายปีจากข้อมูลโครงการที่บันทึกไว้
    const yearlyCSeqList = [
      Number(selectedProject.credit_year_1) || 0,
      Number(selectedProject.credit_year_2) || 0,
      Number(selectedProject.credit_year_3) || 0,
    ];

    const yearlyExpenseList = [
      Number(expenseYear1) || 0,
      Number(expenseYear2) || 0,
      Number(expenseYear3) || 0,
    ];

    const yearLabels = ["ปีที่ 1", "ปีที่ 2 (คาดการณ์)", "ปีที่ 3 (คาดการณ์)"];

    const allYearsCalculatedData = yearLabels.map((label, index) => {
      const cSeq = yearlyCSeqList[index];
      const expenses = yearlyExpenseList[index];

      // === สูตรที่ 8: Revenue_T-VER ===
      const creditSold = cSeq * sellRatioDecimal;
      const rev = creditSold * priceCredit;

      // === สูตรที่ 7: Profit_T-VER = Revenue_T-VER - Expenses_T-VER ===
      const profit = rev - expenses;

      // === สูตรที่ 9: Tax_Exempt = Profit_T-VER * CIT_Rate (20%) ===
      const normalTax = profit > 0 ? profit * citRate : 0;
      const exemptTax = profit > 0 ? profit * citRate : 0;

      return {
        yearLabel: label,
        revenue: rev,
        expenses: expenses,
        netProfit: profit,
        normalTax: normalTax,
        exemptTax: exemptTax,
      };
    });

    const year1Data = allYearsCalculatedData[0];
    const year1CSeq = yearlyCSeqList[0];
    const year1CreditSold = year1CSeq * sellRatioDecimal;

    const selectedColumns = allYearsCalculatedData.slice(0, selectedTaxBenefitYears);

    setCalculationResult({
      projectName: selectedProject.project_name || "โครงการปลูกป่า T-VER",
      creditSold: year1CreditSold,
      revenueTVer: year1Data.revenue,
      expensesTVer: year1Data.expenses,
      profitTVer: year1Data.netProfit,
      taxExemptYearly: year1Data.exemptTax,
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
        {/* ฝั่งซ้าย: ฟอร์มตั้งค่าการประเมิน */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-[#11221C]">ตั้งค่าข้อมูลโครงการและภาษี</h2>

          {loadingProjects ? (
            <div className="text-xs text-slate-400 py-4 text-center">กำลังโหลดข้อมูลโครงการ...</div>
          ) : projects.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl text-center">
              ยังไม่พบข้อมูลโครงการป่าไม้ T-VER <br />กรุณาไปที่เมนูจำลองโครงการ T-VER เพื่อสร้างโครงการก่อน
            </div>
          ) : (
            <form onSubmit={handleCalculateTax} className="space-y-4">
              {/* เลือกโครงการป่าไม้จากฐานข้อมูล */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">
                  เลือกโครงการป่าไม้ T-VER
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 font-semibold bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600 appearance-none cursor-pointer"
                  required
                >
                  {projects.map((proj) => {
                    const projId = proj.orgtreeproject_id || proj.id;
                    return (
                      <option key={projId} value={projId}>
                        {proj.project_name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* แสดงค่า C_SEQ ที่ดึงมาจากโครงการที่เลือก (อ่านอย่างเดียว) */}
              {selectedProject && (
                <div className="space-y-2 border-t border-slate-100 pt-3 bg-slate-50/60 p-3 rounded-2xl">
                  <label className="text-xs font-bold text-slate-700 block">
                    ปริมาณการกักเก็บคาร์บอนจากโครงการ (tCO2e/ปี)
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 1</span>
                      <span className="text-xs font-extrabold text-slate-800">{selectedProject.credit_year_1 ?? 0}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 2</span>
                      <span className="text-xs font-extrabold text-slate-800">{selectedProject.credit_year_2 ?? 0}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 3</span>
                      <span className="text-xs font-extrabold text-slate-800">{selectedProject.credit_year_3 ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* สัดส่วนการขายคาร์บอนเครดิต (Ratio_Sell %) แบบ Dropdown 50 หรือ 80 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">
                  สัดส่วนการนำคาร์บอนเครดิตไปจำหน่าย (%)
                </label>
                <select
                  value={ratioSell}
                  onChange={(e) => setRatioSell(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 font-semibold bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600 appearance-none cursor-pointer"
                >
                  <option value={50}>50%</option>
                  <option value={80}>80%</option>
                </select>
              </div>

              {/* ค่าใช้จ่ายตรงของโครงการ (Expenses_T-VER) ที่ผู้ใช้กรอกเองแยก 3 ปี */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="text-xs font-bold text-slate-700 block">
                  ค่าใช้จ่ายตรงของโครงการ (บาท/ปี)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 1</span>
                    <input
                      type="number"
                      value={expenseYear1}
                      onChange={(e) => setExpenseYear1(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 2</span>
                    <input
                      type="number"
                      value={expenseYear2}
                      onChange={(e) => setExpenseYear2(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">ปีที่ 3</span>
                    <input
                      type="number"
                      value={expenseYear3}
                      onChange={(e) => setExpenseYear3(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* ราคาคาร์บอนเครดิตต่อหน่วย */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <label className="text-xs font-bold text-slate-500">
                  ราคาคาร์บอนเครดิต (บาท/tCO2e)
                </label>
                <input
                  type="number"
                  value={carbonPrice}
                  onChange={(e) => setCarbonPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 font-bold bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  required
                />
              </div>

              {/* เลือกระยะเวลาสิทธิประโยชน์ภาษี (1-3 ปี) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">สิทธิประโยชน์ทางภาษี</label>
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
                  คำนวณภาษีและประเมินสิทธิประโยชน์
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ฝั่งขวา: แสดงผลลัพธ์การคำนวณ */}
        <div className="lg:col-span-7 space-y-6">
          {isCalculated && calculationResult ? (
            <>
              {/* ตารางแสดงผลเปรียบเทียบรายปีตามสูตร 7, 8, 9 */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm overflow-x-auto">
                <h3 className="text-sm font-bold text-[#11221C] mb-3">
                  ตารางคำนวณรายได้ กำไร และการยกเว้นภาษี ({calculationResult.selectedYears} รอบบัญชี)
                </h3>
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
                        รายได้โครงการ
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

                    {/* Expenses_T-VER */}
                    <tr>
                      <td className="py-3.5 px-2 font-bold text-slate-800">
                        ค่าใช้จ่ายโครงการ
                      </td>
                      {calculationResult.tableColumns.map((col, idx) => (
                        <td key={idx} className="py-3.5 px-2 text-right text-red-600">
                          -{col.expenses.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      ))}
                    </tr>

                    {/* Profit_T-VER */}
                    <tr>
                      <td className="py-3.5 px-2 font-bold text-slate-800">
                        กำไรสุทธิโครงการ
                      </td>
                      {calculationResult.tableColumns.map((col, idx) => (
                        <td key={idx} className="py-3.5 px-2 text-right font-bold text-emerald-700">
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

              {/* การ์ดสรุปรายละเอียดปีที่ 1 ตาม Proposal */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-[#11221C]">
                  สรุปผลการวิเคราะห์โครงการ ({calculationResult.projectName})
                </h3>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">ปริมาณคาร์บอนเครดิตที่จัดสรรจำหน่าย</span>
                    <span className="font-extrabold text-slate-800">
                      {calculationResult.creditSold.toLocaleString("th-TH", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      tCO2e
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">รายได้จากการขายเครดิต ปีที่ 1</span>
                    <span className="font-extrabold text-slate-800">
                      ฿{" "}
                      {calculationResult.revenueTVer.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">กำไรสุทธิเฉพาะโครงการ ปีที่ 1</span>
                    <span className="font-extrabold text-emerald-700">
                      ฿{" "}
                      {calculationResult.profitTVer.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
                    <span className="font-bold text-slate-700">ภาษีเงินได้นิติบุคคลที่ได้รับการยกเว้น ปีที่ 1</span>
                    <span className="font-extrabold text-emerald-800 text-sm">
                      ฿{" "}
                      {calculationResult.taxExemptYearly.toLocaleString("th-TH", {
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
              เลือกโครงการป่าไม้และกรอกค่าใช้จ่ายฝั่งซ้าย แล้วกดปุ่มคำนวณภาษีเพื่อดูรายงานผลลัพธ์
            </div>
          )}
        </div>
      </div>
    </div>
  );
}