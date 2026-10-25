"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Save,
  Calculator,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ProjectForm = {
  projectName: string;
  treeType: string;
  area: string;
  treesPerRai: string;
  startDate: string;
};

type CreditRecord = {
  id: string;
  name: string;
  amount: number;
};

type TargetRule = {
  target_id: string;
  target_name: string;
  offset_ratio: number;
  sell_ratio: number;
};

type MessageType = "success" | "error" | "";

const treeOptions = [
  "สัก (Tectona grandis)",
  "ยูคาลิปตัส (Eucalyptus)",
  "โกงกาง (Rhizophora)",
  "ประดู่ (Pterocarpus macrocarpus)",
];

const formatNumber = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2,
  }).format(value);

export default function TVERSimulationPage() {
  const [step, setStep] = useState<1 | 2>(1);

  const [project, setProject] = useState<ProjectForm>({
    projectName: "โครงการปลูกป่าสัก ที่ราบสูงตอนเหนือ",
    treeType: treeOptions[0],
    area: "500",
    treesPerRai: "125",
    startDate: "2024-01-01",
  });

  const [goal, setGoal] = useState<"netzero" | "neutral" | "selling">(
    "neutral"
  );

  const [creditRecords, setCreditRecords] = useState<CreditRecord[]>([]);
  const [targetRules, setTargetRules] = useState<TargetRule[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [calculated, setCalculated] = useState(false);
  const [allocationCalculated, setAllocationCalculated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงข้อมูลรายการปล่อยก๊าซ, org_id และ target_id จาก Supabase เมื่อโหลดหน้าเว็บ
  useEffect(() => {
    const fetchData = async () => {
      setLoadingRecords(true);
      try {
        let fetchedOrgId = null;

        // 1. ดึงข้อมูลจากตาราง organization อย่างปลอดภัย
        const { data: orgDataList, error: orgFetchError } = await supabase
          .from("organization")
          .select("*")
          .limit(1);

        if (!orgFetchError && orgDataList && orgDataList.length > 0) {
          const orgRecord = orgDataList[0];
          fetchedOrgId = orgRecord.org_id || orgRecord.id;
          console.log("ดึงรหัสองค์กรสำเร็จ:", fetchedOrgId);
        } else {
          console.warn("ไม่พบข้อมูลองค์กรในตาราง organization");
        }

        setOrgId(fetchedOrgId);

        // 2. ดึงข้อมูลรายการปล่อยก๊าซ (ตารางที่ 12: org_activity_list)
        const { data: activityData, error: actError } = await supabase
          .from("org_activity_list")
          .select("orgactlist_id, orgact_name, total_ghg_emission");

        if (actError) throw actError;

        if (activityData && activityData.length > 0) {
          const mappedRecords: CreditRecord[] = activityData.map((item: any) => ({
            id: item.orgactlist_id,
            name: item.orgact_name || "บันทึกการปล่อยก๊าซ",
            amount: Number(item.total_ghg_emission || 0),
          }));
          setCreditRecords(mappedRecords);
        }

        // 3. ดึงข้อมูลเป้าหมายจากตาราง project_target_rule (ตารางที่ 19)
        const { data: targetData, error: targetError } = await supabase
          .from("project_target_rule")
          .select("target_id, target_name, offset_ratio, sell_ratio");

        if (!targetError && targetData) {
          setTargetRules(targetData);
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchData();
  }, []);

  const area = Math.max(0, Number(project.area) || 0);
  const treesPerRai = Math.max(0, Number(project.treesPerRai) || 0);
  const totalTrees = area * treesPerRai;

  const yearlyCredits = useMemo(() => {
    const MAI = 9.5; 
    return [1, 2, 3].map((year) =>
      Math.round(totalTrees * year * MAI * 0.001 * 100) / 100
    );
  }, [totalTrees]);

  const cumulativeCredits = yearlyCredits;
  const totalCredits = cumulativeCredits[cumulativeCredits.length - 1];

  const allocationRatio = {
    netzero: { offset: 100, sell: 0 },
    neutral: { offset: 50, sell: 50 },
    selling: { offset: 20, sell: 80 },
  }[goal];

  const year1Credit = yearlyCredits[0];
  const creditsForOffset = year1Credit * (allocationRatio.offset / 100);
  const creditsForSale = year1Credit * (allocationRatio.sell / 100);

  const selectedTotal = creditRecords
    .filter((record) => selectedRecords.includes(record.id))
    .reduce((sum, record) => sum + record.amount, 0);

  const offsetApplied = Math.min(selectedTotal, creditsForOffset);
  const remainingOffsetCredit = Math.max(0, creditsForOffset - offsetApplied);
  const remainingEmissions = Math.max(0, selectedTotal - offsetApplied);

  const maxCredit = Math.max(...cumulativeCredits, 1);

  const showMessage = (text: string, type: MessageType) => {
    setMessage(text);
    setMessageType(type);
  };

  const clearMessage = () => {
    setMessage("");
    setMessageType("");
  };

  const updateProject = (field: keyof ProjectForm, value: string) => {
    setProject((previous) => ({
      ...previous,
      [field]: value,
    }));

    setCalculated(false);
    setAllocationCalculated(false);
    setSaved(false);
    setSelectedRecords([]);
    clearMessage();
  };

  const toggleRecord = (id: string) => {
    setSelectedRecords((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );

    setAllocationCalculated(false);
    setSaved(false);
    clearMessage();
  };

  const handleCalculate = () => {
    clearMessage();
    setCalculated(false);
    setSaved(false);

    if (!project.projectName.trim()) {
      showMessage("กรุณากรอกชื่อโครงการ", "error");
      return;
    }

    if (
      project.area.trim() === "" ||
      project.treesPerRai.trim() === "" ||
      !Number.isFinite(Number(project.area)) ||
      !Number.isFinite(Number(project.treesPerRai)) ||
      area <= 0 ||
      treesPerRai <= 0
    ) {
      showMessage("กรุณากรอกพื้นที่และจำนวนต้นไม้ต่อไร่ให้มากกว่า 0", "error");
      return;
    }

    if (!project.startDate) {
      showMessage("กรุณาเลือกวันที่เริ่มโครงการ", "error");
      return;
    }

    setCalculated(true);
    showMessage("คำนวณประมาณการตามระเบียบวิธี T-VER เรียบร้อยแล้ว", "success");
  };

  const handleCalculateAllocation = () => {
    clearMessage();
    if (selectedRecords.length === 0) {
      setAllocationCalculated(false);
      showMessage("กรุณาเลือกรายการปล่อยก๊าซอย่างน้อย 1 รายการก่อนคำนวณการจัดสรร", "error");
      return;
    }

    setAllocationCalculated(true);
    showMessage("คำนวณผลการจัดสรรและหักลบก๊าซเรือนกระจกเรียบร้อยแล้ว", "success");
  };

  // ฟังก์ชันบันทึกข้อมูลพร้อมผูก org_id และ target_id จริง
  const handleSave = async () => {
    clearMessage();

    if (!orgId) {
      showMessage("ไม่พบข้อมูลรหัสองค์กร (org_id) กรุณาตรวจสอบข้อมูลในตาราง organization", "error");
      return;
    }

    if (!allocationCalculated) {
      showMessage("กรุณากดคำนวณการจัดสรรเครดิตก่อนบันทึก", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const matchedTarget = targetRules.find((rule) => {
        if (goal === "netzero") return rule.offset_ratio === 100;
        if (goal === "neutral") return rule.offset_ratio === 50;
        if (goal === "selling") return rule.offset_ratio === 20;
        return false;
      });
      const targetIdToSave = matchedTarget ? matchedTarget.target_id : null;

      // 1. บันทึกข้อมูลโครงการปลูกป่าลงตาราง org_tree_project
      const { data: existingProjects, error: searchError } = await supabase
        .from("org_tree_project")
        .select("orgtreeproject_id")
        .eq("project_name", project.projectName);

      if (searchError) throw searchError;

      let projectId;
      const existingProject = existingProjects?.[0];

      if (existingProject) {
        const { data: updatedData, error: updateError } = await supabase
          .from("org_tree_project")
          .update({
            org_id: orgId,
            join_year: new Date(project.startDate).getFullYear(),
            credit_year_1: yearlyCredits[0],
            credit_year_2: yearlyCredits[1],
            credit_year_3: yearlyCredits[2],
            updated_date: new Date().toISOString(),
          })
          .eq("orgtreeproject_id", existingProject.orgtreeproject_id)
          .select("orgtreeproject_id");

        if (updateError) throw updateError;
        projectId = updatedData?.[0]?.orgtreeproject_id || existingProject.orgtreeproject_id;
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from("org_tree_project")
          .insert([
            {
              org_id: orgId,
              project_name: project.projectName,
              join_year: new Date(project.startDate).getFullYear(),
              credit_year_1: yearlyCredits[0],
              credit_year_2: yearlyCredits[1],
              credit_year_3: yearlyCredits[2],
            },
          ])
          .select("orgtreeproject_id");

        if (insertError) throw insertError;
        projectId = insertedData?.[0]?.orgtreeproject_id;
      }

      if (!projectId) throw new Error("ไม่สามารถบันทึกข้อมูลโครงการได้");

      // 2. บันทึกข้อมูลการจัดสรรหลักลงตาราง org_credit_allocation
      const { data: existingAllocations, error: allocSearchError } = await supabase
        .from("org_credit_allocation")
        .select("orgallocate_id")
        .eq("orgtreeproject_id", projectId);

      if (allocSearchError) throw allocSearchError;

      let allocateId;
      const existingAlloc = existingAllocations?.[0];

      if (existingAlloc) {
        const { data: updatedAlloc, error: updateAllocError } = await supabase
          .from("org_credit_allocation")
          .update({
            target_id: targetIdToSave,
            total_credit: totalCredits,
            net_usable_credit: creditsForOffset,
            offset_credit: offsetApplied,
            remaining_credit: creditsForSale,
            updated_date: new Date().toISOString(),
          })
          .eq("orgallocate_id", existingAlloc.orgallocate_id)
          .select("orgallocate_id");

        if (updateAllocError) throw updateAllocError;
        allocateId = updatedAlloc?.[0]?.orgallocate_id || existingAlloc.orgallocate_id;
      } else {
        const { data: insertedAlloc, error: insertAllocError } = await supabase
          .from("org_credit_allocation")
          .insert([
            {
              orgtreeproject_id: projectId,
              target_id: targetIdToSave,
              total_credit: totalCredits,
              net_usable_credit: creditsForOffset,
              offset_credit: offsetApplied,
              remaining_credit: creditsForSale,
            },
          ])
          .select("orgallocate_id");

        if (insertAllocError) throw insertAllocError; // แก้ไขให้ใช้ insertAllocError ให้ถูกต้อง
        allocateId = insertedAlloc?.[0]?.orgallocate_id;
      }

      if (!allocateId) throw new Error("ไม่สามารถบันทึกข้อมูลการจัดสรรหลักได้");

      // 3. บันทึกรายละเอียดการจัดสรรลงตาราง org_credit_allocation_detail
      await supabase
        .from("org_credit_allocation_detail")
        .delete()
        .eq("orgallocate_id", allocateId);

      const detailPayloads = selectedRecords.map((actListId) => {
        const record = creditRecords.find((r) => r.id === actListId);
        const itemAmount = record ? record.amount : 0;
        return {
          orgallocate_id: allocateId,
          orgactlist_id: actListId,
          net_usable_credit: creditsForOffset,
          offset_credit: Math.min(itemAmount, creditsForOffset),
          remaining_credit: creditsForSale,
        };
      });

      if (detailPayloads.length > 0) {
        const { error: detailError } = await supabase
          .from("org_credit_allocation_detail")
          .insert(detailPayloads);

        if (detailError) throw detailError;
      }

      setSaved(true);
      showMessage("บันทึกและอัปเดตข้อมูลลงฐานข้อมูลเรียบร้อย", "success");
    } catch (error: any) {
      console.error("Database error details:", error);
      const errCode = error?.code || "";
      const errMessage = error?.message || "";
      const errDetails = error?.details || "";
      
      const displayMsg = errMessage 
        ? `[${errCode}] ${errMessage} ${errDetails ? `(รายละเอียด: ${errDetails})` : ""}` 
        : JSON.stringify(error);

      showMessage(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${displayMsg}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const messageClass =
    messageType === "success" ? "text-emerald-700" : "text-red-600";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              จำลองโครงการ T-VER
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              การจำลองโครงการปลูกป่าและการจัดสรรคาร์บอนเครดิต
            </p>
          </div>

          {step === 2 && allocationCalculated && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการจัดสรรและบันทึกฐานข้อมูล"}
            </button>
          )}
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep(1);
              clearMessage();
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 font-semibold text-white">
              {step === 2 ? <Check size={16} /> : "1"}
            </span>
            <span
              className={
                step === 1 ? "font-semibold text-gray-800" : "text-gray-500"
              }
            >
              จำลองโครงการ
            </span>
          </button>

          <div className="h-px w-12 bg-gray-300" />

          <button
            type="button"
            onClick={() => {
              if (calculated) {
                setStep(2);
                clearMessage();
              } else {
                showMessage("กรุณากรอกข้อมูลและคำนวณโครงการก่อน", "error");
              }
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${
                step === 2
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              2
            </span>
            <span
              className={
                step === 2 ? "font-semibold text-gray-800" : "text-gray-400"
              }
            >
              จัดสรรเครดิตและรายงาน
            </span>
          </button>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[0.82fr_1.18fr]">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="mb-6 text-lg font-bold text-gray-800">
                ตั้งค่าโครงการปลูกป่า
              </h2>

              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="projectName"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    ชื่อโครงการ
                  </label>
                  <input
                    id="projectName"
                    value={project.projectName}
                    onChange={(e) => updateProject("projectName", e.target.value)}
                    placeholder="กรอกชื่อโครงการ"
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="treeType"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    พันธุ์ไม้
                  </label>
                  <div className="relative">
                    <select
                      id="treeType"
                      value={project.treeType}
                      onChange={(e) => updateProject("treeType", e.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-3 pr-10 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                    >
                      {treeOptions.map((tree) => (
                        <option key={tree} value={tree}>
                          {tree}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="area"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      พื้นที่ปลูก (ไร่)
                    </label>
                    <input
                      id="area"
                      type="number"
                      min="0"
                      value={project.area}
                      onChange={(e) => updateProject("area", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="treesPerRai"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      จำนวนต้นไม้ต่อไร่
                    </label>
                    <input
                      id="treesPerRai"
                      type="number"
                      min="1"
                      value={project.treesPerRai}
                      onChange={(e) => updateProject("treesPerRai", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="startDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    วันที่เริ่มโครงการ
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={project.startDate}
                    onChange={(e) => updateProject("startDate", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {message && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`text-sm leading-6 ${messageClass}`}
                  >
                    {message}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCalculate}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#31865F] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#26734F] cursor-pointer"
                >
                  คำนวณและดูรายงาน
                  <ArrowRight size={17} />
                </button>

                {calculated && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep(2);
                      clearMessage();
                    }}
                    className="w-full rounded-xl border border-emerald-200 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                  >
                    ไปขั้นตอนจัดสรรเครดิต
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              {!calculated ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                  <h2 className="text-lg font-bold text-gray-700">
                    การประมาณคาร์บอนเครดิตสะสม 3 ปี
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                    กรอกข้อมูลโครงการแล้วกดคำนวณเพื่อแสดงกราฟยอดสะสมคาร์บอนเครดิตของโครงการปลูกป่า
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-800">
                    การประมาณคาร์บอนเครดิตสะสม 3 ปี
                  </h2>

                  <div className="mt-7 flex h-72">
                    <div className="flex flex-col justify-between pb-7 pr-3 text-right text-xs text-gray-400">
                      {[
                        maxCredit,
                        maxCredit * 0.75,
                        maxCredit * 0.5,
                        maxCredit * 0.25,
                        0,
                      ].map((tick, index) => (
                        <span key={index}>{formatNumber(tick)}</span>
                      ))}
                    </div>

                    <div className="relative flex flex-1 items-end justify-around border-b border-gray-200">
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                        {[0, 1, 2, 3].map((line) => (
                          <div
                            key={line}
                            className="border-t border-dashed border-gray-100"
                          />
                        ))}
                      </div>

                      {cumulativeCredits.map((credit, index) => (
                        <div
                          key={index}
                          className="z-10 flex h-full w-1/4 flex-col items-center justify-end"
                        >
                          <div className="flex h-full w-full items-end justify-center">
                            <div
                              className={`w-12 max-w-[70%] rounded-t-xl transition-all duration-500 sm:w-16 ${
                                index === 0
                                  ? "bg-green-500"
                                  : index === 1
                                  ? "bg-amber-400"
                                  : "bg-sky-500"
                              }`}
                              style={{
                                height: `${Math.max(
                                  4,
                                  (credit / maxCredit) * 100
                                )}%`,
                              }}
                              title={`${formatNumber(credit)} tCO₂e`}
                            />
                          </div>
                          <span className="mt-2 whitespace-nowrap text-xs text-gray-500">
                            ปีที่ {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {cumulativeCredits.map((credit, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center sm:p-4"
                      >
                        <p className="text-xs text-gray-500">
                          ปีที่ {index + 1}
                        </p>
                        <p className="mt-2 text-xl font-bold text-green-600">
                          {formatNumber(credit)}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">tCO₂e สะสม</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="mb-6 text-lg font-bold text-gray-800">
                ตรรกะการจัดสรรเครดิต
              </h2>

              <p className="mb-3 text-sm font-medium text-gray-700">
                เป้าหมายองค์กร
              </p>

              <div className="space-y-3">
                {(
                  [
                    {
                      value: "netzero",
                      title: "เป้าหมายการปล่อยก๊าซสุทธิเป็นศูนย์ (Net Zero)",
                      description: "ชดเชย 100% · ขาย 0%",
                    },
                    {
                      value: "neutral",
                      title: "ความเป็นกลางทางคาร์บอน (Carbon Neutral)",
                      description: "ชดเชย 50% · ขาย 50%",
                    },
                    {
                      value: "selling",
                      title: "การขายเครดิต (Credit Selling)",
                      description: "ชดเชย 20% · ขาย 80%",
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setGoal(item.value);
                      setAllocationCalculated(false);
                      setSaved(false);
                      clearMessage();
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${
                      goal === item.value
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                        : "border-gray-200 hover:border-emerald-300"
                    }`}
                  >
                    <span
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        goal === item.value
                          ? "border-emerald-600 bg-emerald-600"
                          : "border-gray-300"
                      }`}
                    >
                      {goal === item.value && (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-gray-800">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {item.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mb-3 mt-7 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700">
                  เลือกรายการปล่อยก๊าซที่ต้องการจัดสรร
                  <span className="text-red-500"> *</span>
                </p>
                <span className="text-xs text-gray-400">
                  เลือกแล้ว {selectedRecords.length} รายการ
                </span>
              </div>

              {loadingRecords ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  กำลังโหลดรายการปล่อยก๊าซจากฐานข้อมูล...
                </div>
              ) : creditRecords.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 text-xs rounded-xl text-center">
                  ยังไม่มีข้อมูลรายการปล่อยก๊าซในระบบ
                </div>
              ) : (
                <div className="space-y-3">
                  {creditRecords.map((record) => {
                    const checked = selectedRecords.includes(record.id);

                    return (
                      <label
                        key={record.id}
                        className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap ${
                          checked
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-gray-100 bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRecord(record.id)}
                          className="h-4 w-4 shrink-0 accent-emerald-600 cursor-pointer"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-gray-800">
                            {record.name}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-sm font-bold text-gray-800">
                          {formatNumber(record.amount)} tCO₂e
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {message && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-4 text-sm leading-6 ${messageClass}`}
                >
                  {message}
                </p>
              )}

              <div className="mt-4 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">ยอดรวมรายการที่เลือก</span>
                  <span className="font-bold text-gray-900">
                    {formatNumber(selectedTotal)} tCO₂e
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleCalculateAllocation}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#31865F] px-4 py-3 font-bold text-white transition hover:bg-[#26734F] cursor-pointer"
                >
                  <Calculator size={17} />
                  คำนวณการจัดสรรเครดิต
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      clearMessage();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-4 py-3 font-semibold text-gray-600 transition hover:bg-gray-50 cursor-pointer"
                  >
                    <ArrowLeft size={17} />
                    ย้อนกลับ
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitting || !allocationCalculated}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                  >
                    <Save size={17} />
                    {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการจัดสรร"}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              {!allocationCalculated ? (
                <div className="flex min-h-[450px] flex-col items-center justify-center text-center">
                  <h2 className="text-lg font-bold text-gray-700">
                    รายงานผลการจัดสรรเครดิต
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                    เลือกเป้าหมายองค์กรและรายการปล่อยก๊าซ แล้วคำนวณการจัดสรรเครดิตเพื่อดูผลลัพธ์
                  </p>
                </div>
              ) : (
                <>
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-lg font-bold text-gray-900">
                      สรุปผลการจัดสรรและการชดเชย
                    </h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      เป้าหมาย: {goal === "netzero" ? "Net Zero (ชดเชย 100%)" : goal === "neutral" ? "Carbon Neutral (ชดเชย 50% / ขาย 50%)" : "Credit Selling (ชดเชย 20% / ขาย 80%)"}
                    </p>
                  </div>

                  <div className="mt-6 divide-y divide-gray-100 text-sm">
                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">ยอดก๊าซที่เลือกชดเชย</span>
                      <span className="font-semibold text-gray-900">{formatNumber(selectedTotal)} tCO₂e</span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">เครดิตใช้ชดเชยจริง</span>
                      <span className="font-semibold text-emerald-600">-{formatNumber(offsetApplied)} tCO₂e</span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">เครดิตสำหรับขาย (ตามเป้าหมาย)</span>
                      <span className="font-semibold text-gray-900">{formatNumber(creditsForSale)} tCO₂e</span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">โควตาชดเชยส่วนที่เหลือ</span>
                      <span className="font-semibold text-gray-900">{formatNumber(remainingOffsetCredit)} tCO₂e</span>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl bg-gray-50 p-4 border border-gray-200/60">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">ปริมาณก๊าซคงเหลือหลังชดเชย</span>
                      <span className={`text-xl font-bold ${remainingEmissions > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatNumber(remainingEmissions)} tCO₂e
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/organization/tax_calculator"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#31865F] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#26734F] cursor-pointer shadow-sm"
                  >
                    ไปหน้าประเมินการยกเว้นภาษี
                    <ArrowRight size={17} />
                  </Link>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}