"use client";
// [MERGE aom + cyn2 รอบ 3] ไฟล์นี้ = โค้ด cyn2 ทั้งไฟล์ ไม่ได้แก้โค้ด — หน้าจัดสรรคาร์บอนเครดิต (แทน tver_simulation เดิมที่ cyn2 ลบแล้ว)
//   ใช้เครดิตปีที่ 1 (credit_year_1) ที่หน้า tver-simulation ของ aom คำนวณด้วยสูตร cyn2 (lib/tverCredits.ts)
//   บันทึกผ่านฟังก์ชัน save_credit_allocation ในฐานข้อมูล (ไม่มีไฟล์ SQL ใน repo ต้องมีใน Supabase)

// หน้าจัดสรรคาร์บอนเครดิต (TOR ข้อ 10.2–10.4)
//   โครงการเลือกมาจากหน้าจำลองโครงการแล้ว (ส่งมาทาง ?project=) ในหน้านี้เลือกแค่
//   1) เป้าหมาย (จากตาราง project_target_rule ที่แอดมินตั้ง)  2) รายการปล่อยก๊าซ
//   - ใช้ "เครดิตปีที่ 1" ที่หน้าจำลองโครงการบันทึกไว้เท่านั้น ไม่คำนวณเครดิตซ้ำในหน้านี้
//   - ผลแสดงเป็นตารางต่อกิจกรรม และบันทึกด้วยฟังก์ชัน save_credit_allocation (ฐานข้อมูลคำนวณซ้ำอีกรอบ)
//   - ลำดับการหักเครดิต = ลำดับในรายการ (เก่า -> ใหม่) ไม่ขึ้นกับลำดับที่คลิก
//     ผลที่เห็นในหน้านี้จึงตรงกับที่บันทึก และเปิดมาแก้ไขใหม่แล้วได้ผลเดิม

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Calculator, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type GoalOption = {
  target_id: string;
  target_name: string;
  offset_ratio: number; // % ที่ใช้ชดเชย
  sell_ratio: number; // % ที่นำไปขาย
};
export type ActivityOption = { id: string; name: string; amount: number; periodDate: string | null };
export type ProjectOption = { id: string; name: string; year1Credit: number };
export type SavedAllocation = { targetId: string; year1Credit: number; activityIds: string[] };

type Props = {
  project: ProjectOption; // โครงการที่เลือกมาจากหน้าจำลอง
  loadError: string | null;
  goals: GoalOption[];
  activities: ActivityOption[];
  saved: SavedAllocation | null;
};

type Message = { text: string; type: "success" | "error" };

// ปัดทศนิยม 4 ตำแหน่ง เท่ากับที่ฐานข้อมูลเก็บ (numeric(14,4))
const round4 = (v: number) => Math.round((v + Number.EPSILON) * 10000) / 10000;
const fmt = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 4 }).format(v);

// สูตรเดียวกับฟังก์ชัน save_credit_allocation ในฐานข้อมูล
//   โควตาชดเชย = เครดิตปี 1 × % ชดเชย / เครดิตขาย = เครดิตปี 1 × % ขาย
//   หักโควตาจากกิจกรรมทีละรายการตามลำดับ จนโควตาหมด หรือกิจกรรมหมด
function allocate(year1Credit: number, goal: GoalOption, chosen: ActivityOption[]) {
  const year1 = round4(year1Credit);
  const quota = round4((year1 * goal.offset_ratio) / 100);
  const sell = round4((year1 * goal.sell_ratio) / 100);

  let available = quota;
  const rows = chosen.map((a) => {
    const emission = round4(a.amount);
    const applied = round4(Math.min(emission, available));
    available = round4(available - applied);
    return { ...a, emission, applied, remaining: round4(emission - applied) };
  });

  const offsetTotal = round4(rows.reduce((s, r) => s + r.applied, 0));
  return {
    year1,
    quota,
    sell,
    rows,
    offsetTotal,
    unusedQuota: round4(quota - offsetTotal),
    emissionTotal: round4(rows.reduce((s, r) => s + r.emission, 0)),
    remainingTotal: round4(rows.reduce((s, r) => s + r.remaining, 0)),
  };
}

export default function AllocationClient({ project, loadError, goals, activities, saved }: Props) {
  const router = useRouter();

  // เข้าหน้านี้ทีไรให้ขอข้อมูลใหม่จากเซิร์ฟเวอร์เสมอ
  //   กันกรณีกลับมาจากหน้าอื่น (เช่น เพิ่งบันทึกกิจกรรมใหม่ที่หน้าคาร์บอนฟุตพรินต์) แล้วเห็นข้อมูลเก่าจากแคชของ Next
  //   รายการกิจกรรม/เป้าหมาย/เครดิตอ่านจาก props โดยตรง จึงอัปเดตทันทีโดยไม่ล้างสิ่งที่ผู้ใช้เลือกไว้
  useEffect(() => {
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เริ่มจากผลที่เคยบันทึกไว้ (ถ้ามี) เพื่อให้แก้ไขต่อได้
  const savedGoalId = saved && goals.some((g) => g.target_id === saved.targetId) ? saved.targetId : null;
  const [goalId, setGoalId] = useState<string | null>(savedGoalId);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    saved ? saved.activityIds.filter((id) => activities.some((a) => a.id === id)) : []
  );
  const [calculated, setCalculated] = useState(savedGoalId !== null);
  const [savedNow, setSavedNow] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const goal = goals.find((g) => g.target_id === goalId) ?? null;
  const chosen = activities.filter((a) => selectedIds.includes(a.id)); // เรียงตามรายการ ไม่ใช่ตามที่คลิก
  const result = goal ? allocate(project.year1Credit, goal, chosen) : null;

  const hasSaved = saved !== null || savedNow;
  // เครดิตปี 1 ของโครงการเปลี่ยนไปหลังจากบันทึกการจัดสรร (เช่น แก้โครงการในหน้าจำลอง)
  const isStale =
    !savedNow &&
    saved !== null &&
    Math.abs(round4(saved.year1Credit) - round4(project.year1Credit)) > 0.0001;

  function resetResult() {
    setCalculated(false);
    setSavedNow(false);
    setMessage(null);
  }

  function pickGoal(id: string) {
    setGoalId(id);
    resetResult();
  }

  function toggleActivity(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    resetResult();
  }

  function handleCalculate() {
    if (!goal) return setMessage({ text: "กรุณาเลือกเป้าหมายองค์กร", type: "error" });
    if (project.year1Credit <= 0) {
      return setMessage({ text: "โครงการนี้ยังไม่มีเครดิตปีที่ 1 กรุณาบันทึกและคำนวณที่หน้าจำลองโครงการก่อน", type: "error" });
    }
    if (goal.offset_ratio > 0 && chosen.length === 0) {
      return setMessage({ text: "กรุณาเลือกรายการปล่อยก๊าซอย่างน้อย 1 รายการ", type: "error" });
    }
    setMessage(null);
    setCalculated(true);
  }

  async function handleSave() {
    if (!goal || !calculated) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("save_credit_allocation", {
      p_project_id: project.id,
      p_target_id: goal.target_id,
      p_activity_ids: chosen.map((a) => a.id),
    });
    setSubmitting(false);
    if (error) {
      setMessage({ text: `บันทึกไม่สำเร็จ: ${error.message}`, type: "error" });
      return;
    }
    setSavedNow(true);
    setMessage({ text: "บันทึกการจัดสรรเรียบร้อยแล้ว", type: "success" });
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">จัดสรรคาร์บอนเครดิต T-VER</h1>
          <p className="mt-1 text-sm text-gray-500">จัดสรรเครดิตปีที่ 1 ของโครงการตามเป้าหมายองค์กร</p>
        </div>

        {loadError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            โหลดข้อมูลไม่สำเร็จ: {loadError}
          </p>
        )}

        {/* โครงการเลือกมาจากหน้าจำลองแล้ว แสดงอย่างเดียว ไม่ต้องเลือกซ้ำ */}
        <>
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-5 py-4 text-sm">
              <span className="text-gray-600">
                โครงการ <span className="text-lg font-bold text-gray-900">{project.name}</span>
              </span>
              <span className="text-gray-600">
                เครดิตปีที่ 1{" "}
                <span className="text-lg font-bold text-gray-900">{fmt(project.year1Credit)}</span> tCO₂e
              </span>
              {project.year1Credit <= 0 && (
                <span className="text-red-600">
                  ยังไม่มีผลคำนวณ —{" "}
                  <Link
                    href={`/organization/tver-simulation?edit=${project.id}`}
                    className="font-semibold underline"
                  >
                    ไปคำนวณที่หน้าจำลองโครงการ
                  </Link>
                </span>
              )}
              {hasSaved && !isStale && <span className="text-emerald-700">มีผลการจัดสรรที่บันทึกไว้แล้ว แก้ไขได้ด้านล่าง</span>}
            </div>

            {isStale && (
              <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                เครดิตปีที่ 1 ของโครงการเปลี่ยนไปจากตอนที่จัดสรรไว้ ({fmt(round4(saved!.year1Credit))} →{" "}
                {fmt(round4(project.year1Credit))} tCO₂e) กรุณากดคำนวณและบันทึกการจัดสรรใหม่
              </p>
            )}

            <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2">
              {/* ซ้าย: เลือกเป้าหมายและกิจกรรม */}
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
                <h2 className="mb-4 text-lg font-bold text-gray-800">1. เป้าหมายองค์กร</h2>

                {goals.length === 0 ? (
                  <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
                    ยังไม่มีเป้าหมายในระบบ (แอดมินต้องกำหนดเป้าหมายก่อน)
                  </p>
                ) : (
                  <div className="space-y-3">
                    {goals.map((g) => {
                      const active = g.target_id === goalId;
                      return (
                        <button
                          key={g.target_id}
                          type="button"
                          onClick={() => pickGoal(g.target_id)}
                          className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${
                            active
                              ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                              : "border-gray-200 hover:border-emerald-300"
                          }`}
                        >
                          <span
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              active ? "border-emerald-600 bg-emerald-600" : "border-gray-300"
                            }`}
                          >
                            {active && <span className="h-2 w-2 rounded-full bg-white" />}
                          </span>
                          <span>
                            <span className="block text-sm font-bold text-gray-800">{g.target_name}</span>
                            <span className="mt-1 block text-xs text-gray-500">
                              ชดเชย {g.offset_ratio}% · ขาย {g.sell_ratio}%
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mb-3 mt-7 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">2. รายการปล่อยก๊าซที่ต้องการชดเชย</h2>
                  <span className="text-xs text-gray-400">เลือกแล้ว {selectedIds.length} รายการ</span>
                </div>

                {activities.length === 0 ? (
                  <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
                    ยังไม่มีรายการปล่อยก๊าซ กรุณาบันทึกกิจกรรมที่เมนูคาร์บอนฟุตพรินต์ก่อน
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activities.map((a) => {
                      const checked = selectedIds.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                            checked ? "border-emerald-300 bg-emerald-50" : "border-gray-100 bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleActivity(a.id)}
                            className="h-4 w-4 cursor-pointer accent-emerald-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-gray-800">{a.name}</span>
                            {a.periodDate && <span className="block text-xs text-gray-400">{a.periodDate}</span>}
                          </span>
                          <span className="whitespace-nowrap text-sm font-bold text-gray-800">
                            {fmt(a.amount)} tCO₂e
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
                    className={`mt-4 text-sm leading-6 ${message.type === "success" ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {message.text}
                  </p>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={handleCalculate}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#31865F] px-4 py-3 font-bold text-white transition hover:bg-[#26734F] cursor-pointer"
                  >
                    <Calculator size={17} />
                    คำนวณการจัดสรรเครดิต
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    {/* กลับไปแก้โครงการเดิมที่หน้าจำลองโครงการ */}
                    <Link
                      href={`/organization/tver-simulation?edit=${project.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 font-semibold text-gray-600 transition hover:bg-gray-50 cursor-pointer"
                    >
                      <ArrowLeft size={17} />
                      ย้อนกลับ
                    </Link>

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={submitting || !calculated}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={17} />
                      {submitting ? "กำลังบันทึก..." : "บันทึกการจัดสรร"}
                    </button>
                  </div>
                </div>
              </section>

              {/* ขวา: ผลการจัดสรร (ข้อ 10.4 แสดงเป็นตาราง) */}
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
                {!calculated || !result || !goal ? (
                  <div className="flex min-h-[450px] flex-col items-center justify-center text-center">
                    <h2 className="text-lg font-bold text-gray-700">รายงานผลการจัดสรรเครดิต</h2>
                    <p className="mt-2 max-w-sm text-sm text-gray-400">
                      เลือกเป้าหมายและรายการปล่อยก๊าซ แล้วกดคำนวณเพื่อดูผลลัพธ์
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-gray-100 pb-4">
                      <h2 className="text-lg font-bold text-gray-900">สรุปผลการจัดสรรและการชดเชย</h2>
                      <p className="mt-0.5 text-sm text-gray-500">
                        เป้าหมาย: {goal.target_name} (ชดเชย {goal.offset_ratio}% / ขาย {goal.sell_ratio}%)
                      </p>
                    </div>

                    <div className="mt-4 divide-y divide-gray-100 text-sm">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-gray-600">เครดิตปีที่ 1</span>
                        <span className="font-semibold text-gray-900">{fmt(result.year1)} tCO₂e</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-gray-600">โควตาชดเชย ({goal.offset_ratio}%)</span>
                        <span className="font-semibold text-gray-900">{fmt(result.quota)} tCO₂e</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-gray-600">เครดิตที่ใช้ชดเชยจริง</span>
                        <span className="font-semibold text-emerald-600">-{fmt(result.offsetTotal)} tCO₂e</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-gray-600">โควตาชดเชยที่ไม่ได้ใช้ (ไม่นำไปขาย)</span>
                        <span className="font-semibold text-gray-900">{fmt(result.unusedQuota)} tCO₂e</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-gray-600">เครดิตสำหรับขาย ({goal.sell_ratio}%)</span>
                        <span className="font-semibold text-gray-900">{fmt(result.sell)} tCO₂e</span>
                      </div>
                    </div>

                    <h3 className="mb-2 mt-6 text-sm font-bold text-gray-800">ผลการหักเครดิตแต่ละกิจกรรม</h3>
                    {result.rows.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-500">
                        ไม่ได้เลือกกิจกรรม (ไม่มีการชดเชย)
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">กิจกรรม</th>
                              <th className="px-3 py-2 text-right font-medium">ก๊าซที่ปล่อย</th>
                              <th className="px-3 py-2 text-right font-medium">เครดิตที่ใช้ชดเชย</th>
                              <th className="px-3 py-2 text-right font-medium">ก๊าซคงเหลือ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {result.rows.map((r) => (
                              <tr key={r.id}>
                                <td className="px-3 py-2 text-gray-800">{r.name}</td>
                                <td className="px-3 py-2 text-right text-gray-800">{fmt(r.emission)}</td>
                                <td className="px-3 py-2 text-right text-emerald-600">-{fmt(r.applied)}</td>
                                <td
                                  className={`px-3 py-2 text-right font-semibold ${
                                    r.remaining > 0 ? "text-red-600" : "text-emerald-600"
                                  }`}
                                >
                                  {fmt(r.remaining)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-bold text-gray-900">
                            <tr>
                              <td className="px-3 py-2">รวม (tCO₂e)</td>
                              <td className="px-3 py-2 text-right">{fmt(result.emissionTotal)}</td>
                              <td className="px-3 py-2 text-right">-{fmt(result.offsetTotal)}</td>
                              <td
                                className={`px-3 py-2 text-right ${
                                  result.remainingTotal > 0 ? "text-red-600" : "text-emerald-600"
                                }`}
                              >
                                {fmt(result.remainingTotal)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {hasSaved && (
                      <Link
                        href={`/organization/tax_calculator?project=${project.id}`}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#31865F] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#26734F] cursor-pointer"
                      >
                        ไปหน้าประเมินการยกเว้นภาษี
                        <ArrowRight size={17} />
                      </Link>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
      </div>
    </div>
  );
}
