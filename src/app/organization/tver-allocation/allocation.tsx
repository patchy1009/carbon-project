"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, Save, Calculator } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// กำหนด Type ให้ตรงกับตาราง tree_list ใน Supabase (มี tree_id และ tree_name)
type TreeOption = {
  tree_id: string;
  tree_name: string;
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

// [สำคัญ] ประกาศ Props ทั้งหมดที่จะรับมาจาก page.tsx ให้ครบถ้วน
interface AllocationClientProps {
  treeOptions: TreeOption[];
  initialProjectName: string;
  initialStartDate: string;
  initialTreeId: string;
  initialArea: string;
  initialTreesPerRai: string;
  linkedProjectId: string | null;
  linkedCredits: [number, number, number] | null;
  initialStep: 1 | 2;
  creditRecords: CreditRecord[];
  targetRules: TargetRule[];
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);

export default function AllocationClient({
  treeOptions,
  initialProjectName,
  initialStartDate,
  initialTreeId,
  initialArea,
  initialTreesPerRai,
  linkedProjectId,
  linkedCredits,
  initialStep,
  creditRecords,
  targetRules,
}: AllocationClientProps) {
  const router = useRouter();

  const [step] = useState<1 | 2>(initialStep);
  const [project] = useState({
    projectName: initialProjectName,
    selectedTreeId: initialTreeId || treeOptions[0]?.tree_id || "",
    area: initialArea,
    treesPerRai: initialTreesPerRai,
    startDate: initialStartDate,
  });

  const [goal, setGoal] = useState<"netzero" | "neutral" | "selling">("neutral");
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [allocationCalculated, setAllocationCalculated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const area = Math.max(0, Number(project.area) || 0);
  const treesPerRai = Math.max(0, Number(project.treesPerRai) || 0);
  const totalTrees = area * treesPerRai;

  const yearlyCredits = useMemo(() => {
    if (linkedCredits) return linkedCredits;
    const MAI = 9.5; 
    return [1, 2, 3].map((year) =>
      Math.round(totalTrees * year * MAI * 0.001 * 100) / 100
    );
  }, [totalTrees, linkedCredits]);

  const totalCredits = linkedCredits
    ? linkedCredits[0] + linkedCredits[1] + linkedCredits[2]
    : yearlyCredits[yearlyCredits.length - 1];

  const allocationRatio = {
    netzero: { offset: 100, sell: 0 },
    neutral: { offset: 50, sell: 50 },
    selling: { offset: 20, sell: 80 },
  }[goal];

  const year1Credit = yearlyCredits[0];
  const creditsForSale = year1Credit * (allocationRatio.sell / 100);

  const selectedTotal = creditRecords
    .filter((record) => selectedRecords.includes(record.id))
    .reduce((sum, record) => sum + record.amount, 0);

  const offsetApplied = Math.min(selectedTotal, year1Credit * (allocationRatio.offset / 100));
  const remainingEmissions = Math.max(0, selectedTotal - offsetApplied);

  const showMessage = (text: string, type: MessageType) => {
    setMessage(text);
    setMessageType(type);
  };

  const clearMessage = () => {
    setMessage("");
    setMessageType("");
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

  const handleCalculateAllocation = () => {
    clearMessage();
    if (selectedRecords.length === 0) {
      setAllocationCalculated(false);
      showMessage("กรุณาเลือกรายการปล่อยก๊าซอย่างน้อย 1 รายการ", "error");
      return;
    }
    setAllocationCalculated(true);
    showMessage("คำนวณการจัดสรรเครดิตเรียบร้อยแล้ว", "success");
  };

  const handleSave = async () => {
    clearMessage();
    if (!allocationCalculated) {
      showMessage("กรุณากดคำนวณการจัดสรรเครดิตก่อนบันทึก", "error");
      return;
    }
    if (!linkedProjectId) {
      showMessage("ไม่พบรหัสโครงการ (Project ID) ที่เชื่อมโยง", "error");
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

      if (!targetIdToSave) {
        throw new Error("ไม่พบข้อมูลกฎเป้าหมาย (Target Rule) ในระบบ");
      }

      const { error: rpcError } = await supabase.rpc("save_credit_allocation", {
        p_project_id: linkedProjectId,
        p_target_id: targetIdToSave,
        p_activity_ids: selectedRecords,
      });

      if (rpcError) throw rpcError;

      setSaved(true);
      showMessage("บันทึกการจัดสรรเครดิตลงฐานข้อมูลสำเร็จ", "success");
    } catch (error: any) {
      console.error("RPC Error Details:", error);
      showMessage(`เกิดข้อผิดพลาดในการบันทึก: ${error?.message || "Unknown error"}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const messageClass = messageType === "success" ? "text-emerald-700" : "text-red-600";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              จัดสรรคาร์บอนเครดิต T-VER
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              โครงการ: {project.projectName || "ไม่ระบุชื่อโครงการ"} · เครดิตรวม 3 ปี: {formatNumber(totalCredits)} tCO₂e
            </p>
          </div>

          {allocationCalculated && (
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

        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="mb-6 text-lg font-bold text-gray-800">
              เลือกเป้าหมายองค์กรและรายการปล่อยก๊าซ
            </h2>

            <div className="space-y-3">
              {(
                [
                  { value: "netzero", title: "Net Zero (ชดเชย 100%)", description: "ชดเชย 100% · ขาย 0%" },
                  { value: "neutral", title: "Carbon Neutral (ชดเชย 50% / ขาย 50%)", description: "ชดเชย 50% · ขาย 50%" },
                  { value: "selling", title: "Credit Selling (ชดเชย 20% / ขาย 80%)", description: "ชดเชย 20% · ขาย 80%" },
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
                  <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${goal === item.value ? "border-emerald-600 bg-emerald-600" : "border-gray-300"}`}>
                    {goal === item.value && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-gray-800">{item.title}</span>
                    <span className="mt-1 block text-xs text-gray-500">{item.description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-3 mt-7 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                รายการปล่อยก๊าซจากฐานข้อมูล <span className="text-red-500">*</span>
              </p>
              <span className="text-xs text-gray-400">เลือกแล้ว {selectedRecords.length} รายการ</span>
            </div>

            {creditRecords.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 text-xs rounded-xl text-center">
                ไม่พบข้อมูลรายการปล่อยก๊าซในระบบ
              </div>
            ) : (
              <div className="space-y-3">
                {creditRecords.map((record) => {
                  const checked = selectedRecords.includes(record.id);
                  return (
                    <label
                      key={record.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                        checked ? "border-emerald-300 bg-emerald-50" : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecord(record.id)}
                        className="h-4 w-4 accent-emerald-600 cursor-pointer"
                      />
                      <span className="flex-1 text-sm font-bold text-gray-800">{record.name}</span>
                      <span className="text-sm font-bold text-gray-800">{formatNumber(record.amount)} tCO₂e</span>
                    </label>
                  );
                })}
              </div>
            )}

            {message && (
              <p role="status" aria-live="polite" className={`mt-4 text-sm leading-6 ${messageClass}`}>
                {message}
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleCalculateAllocation}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#31865F] px-4 py-3 font-bold text-white transition hover:bg-[#26734F] cursor-pointer"
              >
                <Calculator size={17} />
                คำนวณการจัดสรรเครดิต
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting || !allocationCalculated}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
              >
                <Save size={17} />
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการจัดสรร"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
            {!allocationCalculated ? (
              <div className="flex min-h-[450px] flex-col items-center justify-center text-center">
                <h2 className="text-lg font-bold text-gray-700">รายงานผลการจัดสรรเครดิต</h2>
                <p className="mt-2 max-w-sm text-sm text-gray-400">
                  เลือกรายการปล่อยก๊าซและกดคำนวณการจัดสรรเพื่อดูผลลัพธ์
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">
                  สรุปผลการจัดสรรและการชดเชย
                </h2>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">ยอดก๊าซที่เลือกชดเชย</span>
                    <span className="font-semibold text-gray-900">{formatNumber(selectedTotal)} tCO₂e</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">เครดิตใช้ชดเชยจริง</span>
                    <span className="font-semibold text-emerald-600">-{formatNumber(offsetApplied)} tCO₂e</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">เครดิตสำหรับขาย</span>
                    <span className="font-semibold text-gray-900">{formatNumber(creditsForSale)} tCO₂e</span>
                  </div>
                </div>

                <div className="mt-6 rounded-xl bg-gray-50 p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">ปริมาณก๊าซคงเหลือหลังชดเชย</span>
                    <span className={`text-xl font-bold ${remainingEmissions > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatNumber(remainingEmissions)} tCO₂e
                    </span>
                  </div>
                </div>

                <Link
                  href="/organization/tax_calculator"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#31865F] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#26734F] cursor-pointer shadow-sm"
                >
                  ไปหน้าประเมินการยกเว้นภาษี
                  <ArrowRight size={17} />
                </Link>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}