// หน้าจำลองโครงการ T-VER จากการกักเก็บก๊าซเรือนกระจก (แบบใหม่)
//   องค์กรกรอก: ปริมาณคาร์บอน (พิมพ์เอง หรือเลือกจาก org_activity_list.total_ghg_emission) + ปีสะสม + ชื่อโครงการ
//   ระบบเติมให้ทันที: จำนวนต้นไม้ที่ปลูก พื้นที่ต่อต้น (16 ตร.ม.) จำนวนไร่รวม (ระยะปลูก 4 × 4 ม.) จำนวนไร่ย่อย (แบ่งแปลงตามเงื่อนไขแอดมิน)
//   กดปุ่ม: บันทึกแผน แล้วแสดงกราฟคาร์บอนสะสมปีที่ 1 ถึงปีสะสมที่เลือก
//   สูตรทั้งหมดอยู่ที่ lib/tverTarget.ts / ไม่แตะหน้า tver-simulation (แบบเดิม)
//
// normalize / validate (ใช้กฎกลางของระบบใน lib/validation.ts)
//   1) ชื่อโครงการ: ห้ามว่าง / ตัวเลขล้วน / เกิน 150 ตัวอักษร / คล้ายคำสั่ง SQL
//   2) ปริมาณคาร์บอน (พิมพ์เอง หรือเลือกจากคาร์บอนฟุตพรินต์ที่คำนวณไว้แล้วแก้ต่อได้): ตัวเลข > 0 ทศนิยมไม่เกิน 2 หลัก / ปีสะสม: 1-10
// บันทึก: ชื่อซ้ำกับแผนที่มี = อัปเดตแผนนั้น / เปิดแผนหนึ่งแล้วเปลี่ยนชื่อไปซ้ำกับอีกแผน = แจ้งเตือน ไม่บันทึก
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Select, { ChevronDown } from '@/components/Select';
import FieldError from '@/components/FieldError';
import { supabase } from '@/lib/supabaseClient';
import {
  validateForm, required, requiredSelect, notNumericOnly, maxLength, isDecimal, existsIn, type formSchema,
} from '@/lib/validation';
import { noSqlSyntax } from '@/lib/sqlSyntax';
import { normalizeNumberString, normalizeToArabicNumber, normalizeForCompare } from '@/lib/normalization';
import { dbErrorMessage } from '@/lib/supabaseCrud';
import { showConfirm, showError } from '@/lib/dialog';
import { TVER_AREA_NAME, type TverProjectDetail } from '@/types/tver-project';
import { TVER_SUBPLOT_NAME, type FootprintOption, type OrgTreeTargetPlan, type SavedTargetPlanOption } from '@/types/tver-target';
import {
  calculateTargetPlan, cumulativeByYear, upperLimitFrom, TVER_DEFAULT_MAX_PLOT_RAI, TVER_DEFAULT_MAX_PROJECT_RAI,
  TARGET_YEAR_MIN, TARGET_YEAR_MAX, TARGET_YEAR_DEFAULT,
  type AreaLimit, type PlanInput, type PlanResult,
} from '@/lib/tverTarget';

// เพดานตามชนิดคอลัมน์ในตาราง (numeric(12,2))
const MAX_TARGET = 9999999999.99;

const YEAR_OPTIONS = Array.from({ length: TARGET_YEAR_MAX - TARGET_YEAR_MIN + 1 }, (_, i) => TARGET_YEAR_MIN + i);


// กฎของช่องปริมาณคาร์บอน (ใช้ทั้งตอนกดบันทึก และตอนเติมช่องผลลัพธ์ทันที)
const TARGET_LABEL = 'ปริมาณคาร์บอนที่ต้องชดเชย';
const targetRules = {
  normalize: normalizeNumberString,
  rules: [required(TARGET_LABEL), isDecimal(TARGET_LABEL, { allowZero: false, maxDecimals: 2, max: MAX_TARGET })],
};

// ยอดคาร์บอนฟุตพรินต์ -> ทศนิยม 2 หลัก ปัดขึ้น (ชดเชยไม่ขาด) ใช้ทั้งตอนแสดงในรายการและตอนเติมลงช่อง ให้ตัวเลขตรงกัน toFixed ก่อนกันเศษทศนิยมของคอมพิวเตอร์
const toTwoDecimalsUp = (n: number) => Math.ceil(Number((n * 100).toFixed(6))) / 100;
// วันที่ของรายการ -> เดือน/ปี เช่น "ม.ค. 2569"
const monthYear = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }) : '';

type TopField = 'projectName' | 'target' | 'year';
type ErrorField = TopField;
// ผลที่แสดงอยู่ + ค่าที่ใช้คำนวณ (ผลไม่เปลี่ยนตามฟอร์มจนกว่าจะกดคำนวณใหม่)
type Shown = { plan: PlanResult; input: PlanInput };

const fmtInt = (n: number) => n.toLocaleString('th-TH');
const fmt2 = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

export default function TverTargetClient({
  orgId,
  criteria,
  savedPlans = [],
  existingPlan = null,
  footprints = [],
}: {
  orgId: string; // auth.uid() ของบัญชีที่ล็อกอิน
  criteria: TverProjectDetail[];
  savedPlans?: SavedTargetPlanOption[];
  existingPlan?: OrgTreeTargetPlan | null; // มีค่า = เปิดแผนที่บันทึกไว้
  footprints?: FootprintOption[]; // คาร์บอนฟุตพรินต์ที่องค์กรคำนวณไว้
}) {
  // เพดานจากเงื่อนไขที่แอดมินตั้ง (ไม่มี -> ค่าตามเกณฑ์ T-VER)
  const plotLimit = upperLimitFrom(criteria, TVER_SUBPLOT_NAME, TVER_DEFAULT_MAX_PLOT_RAI);
  const projectLimit = upperLimitFrom(criteria, TVER_AREA_NAME, TVER_DEFAULT_MAX_PROJECT_RAI);

  const [projectName, setProjectName] = useState(existingPlan?.project_name ?? '');
  // รายการคาร์บอนฟุตพรินต์ใต้ช่องปริมาณคาร์บอน (เปิด/ปิด)
  const [fpListOpen, setFpListOpen] = useState(false);
  const [target, setTarget] = useState(existingPlan ? String(Number(existingPlan.target_tco2e)) : '');
  const [year, setYear] = useState(String(existingPlan?.target_year ?? TARGET_YEAR_DEFAULT));
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({});
  const [savedPlanId, setSavedPlanId] = useState<string | null>(existingPlan?.targetplan_id ?? null);
  const [saving, setSaving] = useState(false);
  const [listMode, setListMode] = useState<'filter' | 'all' | null>(null);

  // เปิดแผนที่บันทึกไว้ -> แสดงผลทันทีจากค่าที่บันทึก (คำนวณใหม่ด้วยสูตรเดียวกัน)
  const [shown, setShown] = useState<Shown | null>(() => {
    if (!existingPlan) return null;
    const input: PlanInput = {
      targetTco2e: Number(existingPlan.target_tco2e),
      year: existingPlan.target_year,
      maxProjectArea: projectLimit,
      maxPlotArea: plotLimit,
    };
    return { plan: calculateTargetPlan(input), input };
  });

  // ช่องที่ระบบเติมให้: คำนวณทันทีทุกครั้งที่ปริมาณคาร์บอนหรือปีเปลี่ยน (ค่าไม่ถูกต้อง -> ยังไม่เติม)
  const liveTarget = validateForm<'target'>({ target }, { target: targetRules });
  const live: PlanResult | null =
    liveTarget.ok && YEAR_OPTIONS.includes(Number(year))
      ? calculateTargetPlan({
          targetTco2e: normalizeToArabicNumber(liveTarget.clean.target) ?? 0,
          year: Number(year),
          maxProjectArea: projectLimit,
          maxPlotArea: plotLimit,
        })
      : null;

  // เลือกรายการคาร์บอนฟุตพรินต์ -> เติมยอด (total_ghg_emission) ลงช่องปริมาณคาร์บอน แล้วยังแก้ต่อได้
  function chooseFootprint(f: FootprintOption) {
    setTarget(String(toTwoDecimalsUp(f.amount)));
    clearError('target');
    setFpListOpen(false);
  }

  const clearError = (key: ErrorField) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // เลือกแผนจากรายการใต้ช่องชื่อโครงการ: ค่าว่าง = แผนใหม่ / id = เปิดแผนนั้น (โหลดหน้าใหม่ทั้งหน้า แบบเดียวกับหน้าแบบเดิม)
  function openSavedPlan(id: string) {
    window.location.assign(id ? `/organization/tver-target?edit=${encodeURIComponent(id)}` : '/organization/tver-target');
  }

  /* ---------- ตรวจทั้งฟอร์ม แล้วคืนค่าที่พร้อมคำนวณ ---------- */
  function validateAll():
    | { ok: true; errors: Partial<Record<ErrorField, string>>; clean: Record<TopField, string>; input: PlanInput }
    | { ok: false; errors: Partial<Record<ErrorField, string>> } {
    const schema: formSchema<TopField> = {
      projectName: {
        rules: [required('ชื่อโครงการ'), notNumericOnly('ชื่อโครงการ'), maxLength('ชื่อโครงการ', 150), noSqlSyntax('ชื่อโครงการ')],
      },
      target: targetRules,
      year: { rules: [requiredSelect('ปีที่สะสม'), existsIn('ปี', YEAR_OPTIONS.map(String))] },
    };
    const top = validateForm<TopField>({ projectName, target, year }, schema);
    const errs: Partial<Record<ErrorField, string>> = {};
    if (!top.ok) for (const [k, m] of Object.entries(top.errors)) if (m) errs[k as TopField] = m;

    const hasError = Object.values(errs).some((m) => m);
    if (hasError || !top.ok) return { ok: false, errors: errs };

    const num = (v: string) => normalizeToArabicNumber(v) ?? 0;
    const input: PlanInput = {
      targetTco2e: num(top.clean.target),
      year: Number(top.clean.year),
      maxProjectArea: projectLimit,
      maxPlotArea: plotLimit,
    };
    return { ok: true, errors: errs, clean: top.clean, input };
  }

  /* ---------- บันทึกแผน: ครั้งแรกสร้างใหม่ ครั้งต่อไปอัปเดตแผนเดิม (แบบเดียวกับหน้าแบบเดิม) ---------- */
  async function savePlan(cleanName: string, input: PlanInput): Promise<boolean> {
    const planValues = {
      project_name: cleanName,
      target_tco2e: input.targetTco2e,
      target_year: input.year,
      updated_at: new Date().toISOString(),
    };

    // ชื่อโครงการซ้ำกับแผนที่บันทึกไว้ (ไม่สนช่องว่าง/ตัวพิมพ์) -> อัปเดตแผนนั้น ไม่สร้างแผนใหม่
    //   ดึงชื่อจากฐานข้อมูลทุกครั้ง (รายการในหน้าอาจไม่ล่าสุด)
    const { data: samePlans, error: nameError } = await supabase
      .from('org_tree_target_plan')
      .select('targetplan_id, project_name')
      .eq('org_id', orgId);
    if (nameError) { showError('ตรวจชื่อโครงการไม่สำเร็จ: ' + dbErrorMessage(nameError)); return false; }
    const sameName = (samePlans ?? []).find(
      (p) => normalizeForCompare(p.project_name ?? '') === normalizeForCompare(cleanName)
    );
    if (sameName && savedPlanId && sameName.targetplan_id !== savedPlanId) {
      // กำลังแก้แผนหนึ่งอยู่ แต่เปลี่ยนชื่อไปซ้ำกับอีกแผน -> ไม่ทับแผนอื่น
      showError(`มีแผนชื่อ "${sameName.project_name}" อยู่แล้ว กรุณาใช้ชื่ออื่น หรือเลือกแผนนั้นจากรายการเพื่อแก้ไข`);
      return false;
    }

    let planId = savedPlanId ?? sameName?.targetplan_id ?? null;
    if (planId) {
      if (planId !== savedPlanId) setSavedPlanId(planId); // บันทึกทับแผนชื่อเดิม กดครั้งต่อไปก็อัปเดตแผนนี้
      const { error } = await supabase.from('org_tree_target_plan').update(planValues).eq('targetplan_id', planId);
      if (error) { showError('อัปเดตแผนไม่สำเร็จ: ' + dbErrorMessage(error)); return false; }
    } else {
      const { data, error } = await supabase
        .from('org_tree_target_plan')
        .insert({ org_id: orgId, ...planValues })
        .select('targetplan_id')
        .single();
      if (error || !data) {
        showError('บันทึกแผนไม่สำเร็จ: ' + (error ? dbErrorMessage(error) : 'ไม่ทราบสาเหตุ'));
        return false;
      }
      planId = data.targetplan_id as string;
      setSavedPlanId(planId); // กดครั้งต่อไปเป็นการอัปเดต ไม่สร้างซ้ำ
    }

    return true;
  }

  // กดปุ่ม "บันทึกและแสดงกราฟ": ตรวจ -> แสดงกราฟทันที -> บันทึก
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateAll();
    setErrors(v.errors);
    if (!v.ok) return;

    setShown({ plan: calculateTargetPlan(v.input), input: v.input });
    setSaving(true);
    await savePlan(v.clean.projectName, v.input);
    setSaving(false);
  }

  async function handleDelete() {
    if (!savedPlanId) return;
    const ok = await showConfirm(
      `ต้องการลบแผน "${projectName || 'แผนนี้'}" ใช่หรือไม่`,
      { danger: true }
    );
    if (!ok) return;
    const { error } = await supabase.from('org_tree_target_plan').delete().eq('targetplan_id', savedPlanId);
    if (error) return showError('ลบแผนไม่สำเร็จ: ' + dbErrorMessage(error));
    openSavedPlan('');
  }

  // แผนที่บันทึกไว้ (แผนที่เพิ่งบันทึกครั้งแรกยังไม่อยู่ในรายการจาก server จึงเติมให้)
  const planOptions = [...savedPlans];
  if (savedPlanId && !planOptions.some((p) => p.targetplan_id === savedPlanId)) {
    planOptions.push({ targetplan_id: savedPlanId, project_name: projectName || 'แผนนี้' });
  }

  // รายการใต้ช่องชื่อโครงการ: null = ปิด / 'filter' = กรองตามที่พิมพ์ / 'all' = ทั้งหมด (กดปุ่มลูกศร)
  // แผนที่แสดงในรายการ (ไม่รวมแผนที่เปิดอยู่) ถ้าชื่อในช่องยังเป็นชื่อเดิมของแผนที่เปิดอยู่ ถือว่ายังไม่ได้พิมพ์ค้น
  const otherPlans = planOptions.filter((p) => p.targetplan_id !== savedPlanId);
  const query = projectName.trim().toLowerCase();
  const isSearching = query !== '' && query !== (existingPlan?.project_name ?? '').trim().toLowerCase();
  const shownPlans =
    listMode === 'filter' && isSearching
      ? otherPlans.filter((p) => (p.project_name ?? '').toLowerCase().includes(query))
      : otherPlans;

  const inputClass = (hasError: boolean) =>
    `w-full border rounded-xl px-3 py-3 text-base ${hasError ? 'border-red-500' : 'border-[#E5E7EB]'}`;

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      <div className="mb-6">
        <Link href="/organization/tver" className="text-sm text-[#6B7280] hover:underline">
          ‹ เลือกวิธีคำนวณ
        </Link>
        <h1 className="text-[32px] font-medium text-black">จำลองโครงการ T-VER จากการกักเก็บก๊าซเรือนกระจก</h1>
        <p className="text-base font-medium text-[#6B7280]">
          เลือกคาร์บอนฟุตพรินต์ที่คำนวณไว้ ระบบคำนวณให้ว่าต้องปลูกกี่ต้น ใช้พื้นที่กี่ไร่ และแบ่งเป็นแปลงย่อยกี่แปลง
        </p>
      </div>

      <div className="grid gap-8 items-start lg:grid-cols-[520px_1fr]">
        {/* ซ้าย: ฟอร์ม (noValidate: ใช้ validate ของเราแทน required ของ browser) */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-8 space-y-5"
        >
          <h2 className="text-xl font-bold text-[#1F2937]">ตั้งค่าแผนการปลูก</h2>

          {/* ชื่อโครงการแบบ combobox (แบบเดียวกับหน้าแบบเดิม): พิมพ์ชื่อใหม่ หรือเลือกแผนที่บันทึกไว้จากรายการ (เลือกแล้วเปิดแผนนั้น)
              - คลิก/พิมพ์ในช่อง: รายการกรองตามข้อความที่พิมพ์ / ปุ่มลูกศร: แสดงทั้งหมด */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#374151]">ชื่อโครงการ</label>
            <div className="relative">
              <input
                value={projectName}
                maxLength={150}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  clearError('projectName');
                  setListMode('filter');
                }}
                onFocus={() => setListMode('filter')}
                onBlur={() => setListMode(null)}
                onKeyDown={(e) => e.key === 'Escape' && setListMode(null)}
                placeholder={planOptions.length > 0 ? 'พิมพ์ชื่อโครงการใหม่ หรือเลือกโครงการที่บันทึกไว้' : 'เช่น แผนปลูกป่าชดเชยคาร์บอน ปี 2570'}
                autoComplete="off"
                className={`${inputClass(!!errors.projectName)} ${planOptions.length > 0 ? 'pr-10' : ''}`}
              />
              {planOptions.length > 0 && (
                <button
                  type="button"
                  aria-label="แสดงโครงการที่บันทึกไว้"
                  // onMouseDown + preventDefault: ไม่ให้ช่อง input เสีย focus (ไม่งั้นรายการปิดก่อน)
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setListMode(listMode === 'all' ? null : 'all');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-[#6B7280] hover:text-[#1F2937]"
                >
                  <ChevronDown />
                </button>
              )}
              {listMode && (shownPlans.length > 0 || savedPlanId) && (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                  {shownPlans.map((p) => (
                    <li key={p.targetplan_id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setListMode(null);
                          openSavedPlan(p.targetplan_id);
                        }}
                        className="w-full px-3 py-2 text-left text-base hover:bg-[#F3F4F6]"
                      >
                        {p.project_name || '(ไม่มีชื่อ)'}
                      </button>
                    </li>
                  ))}
                  {/* กำลังเปิดแผนเดิมอยู่ -> มีทางกลับไปเริ่มแผนใหม่ */}
                  {savedPlanId && (
                    <li className="border-t border-[#F3F4F6]">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setListMode(null);
                          openSavedPlan('');
                        }}
                        className="w-full px-3 py-2 text-left text-base text-[#2d4a63] hover:bg-[#F3F4F6]"
                      >
                        + สร้างโครงการใหม่
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <FieldError message={errors.projectName} />
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-4">
            {/* ปริมาณคาร์บอนแบบ combobox: พิมพ์/แก้เองได้ หรือกดลูกศรเลือกจากคาร์บอนฟุตพรินต์ที่คำนวณไว้ (org_activity_list.total_ghg_emission) */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">ปริมาณที่ต้องชดเชย (tCO2e)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    clearError('target');
                  }}
                  onBlur={() => setFpListOpen(false)}
                  onKeyDown={(e) => e.key === 'Escape' && setFpListOpen(false)}
                  placeholder={footprints.length > 0 ? 'กรอก หรือเลือกจากผลคำนวณ' : 'เช่น 1000'}
                  autoComplete="off"
                  className={`${inputClass(!!errors.target)} ${footprints.length > 0 ? 'pr-10' : ''}`}
                />
                {footprints.length > 0 && (
                  <button
                    type="button"
                    aria-label="เลือกจากคาร์บอนฟุตพรินต์ที่คำนวณไว้"
                    // onMouseDown + preventDefault: ไม่ให้ช่อง input เสีย focus (ไม่งั้นรายการปิดก่อน)
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFpListOpen(!fpListOpen);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-[#6B7280] hover:text-[#1F2937]"
                  >
                    <ChevronDown />
                  </button>
                )}
                {fpListOpen && (
                  <ul className="absolute z-20 mt-1 max-h-60 w-[456px] max-w-[calc(100vw-4rem)] overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                    <li className="px-3 py-1.5 text-xs text-[#9CA3AF]">ผลคำนวณคาร์บอนฟุตพรินต์ที่บันทึกไว้</li>
                    {footprints.map((f) => {
                      const usable = toTwoDecimalsUp(f.amount) > 0; // ยอด 0 ใช้คำนวณไม่ได้
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            disabled={!usable}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (usable) chooseFootprint(f);
                            }}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-base hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:text-[#D1D5DB]"
                          >
                            <span className="truncate">
                              {f.name}
                              {f.periodDate && <span className="text-[#9CA3AF]"> ({monthYear(f.periodDate)})</span>}
                            </span>
                            <span className="shrink-0 tabular-nums text-[#6B7280]">{fmt2(toTwoDecimalsUp(f.amount))} tCO2e</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <FieldError message={errors.target} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">สะสมปีที่</label>
              <Select
                value={year}
                onChange={(v) => {
                  setYear(v);
                  clearError('year');
                }}
                className={inputClass(!!errors.year)}
                options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: `${y}` }))}
              />
              <FieldError message={errors.year} />
            </div>
          </div>

          {/* ช่องที่ระบบเติมให้ (แก้ไม่ได้) */}
          <div className="space-y-3 rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] p-4">
            <p className="text-sm font-semibold text-[#374151]">ระบบคำนวณให้</p>
            <AutoField label="จำนวนต้นไม้ที่ปลูก" value={live ? `${fmtInt(live.treesNeeded)} ต้น` : null} />
            <AutoField
              label="พื้นที่ที่ใช้ปลูกต้นไม้ 1 ต้น"
              value={live ? `${fmtNum(live.areaPerTreeSqm)} ตร.ม.` : null}
            />
            <AutoField
              label="จำนวนไร่รวม"
              value={live ? `${fmtInt(live.areaRai)} ไร่` : null}
            />
            <AutoField
              label="จำนวนไร่ย่อย"
              value={live ? `${fmtInt(live.plotCount)} แปลง` : null}
            />
            {live && (
              <p className={`text-sm font-medium ${live.withinLimit ? 'text-[#18794a]' : 'text-red-600'}`}>
                {live.withinLimit ? '✓ ผ่าน' : '✗ เกิน'}เงื่อนไขพื้นที่โครงการ (พื้นที่โครงการ{plotLimitWords(projectLimit)})
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-[239px] h-[60px] rounded-[20px] text-base font-semibold"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกและแสดงกราฟ'}
            </button>
            {savedPlanId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="btn btn-outline h-[60px] rounded-[20px] px-6 text-base font-semibold"
              >
                ลบแผนนี้
              </button>
            )}
          </div>
        </form>

        {/* ขวา: ผลลัพธ์ */}
        <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-8">
          <h2 className="text-xl font-bold text-[#1F2937]">คาร์บอนที่กักเก็บสะสมรายปี</h2>
          <p className="text-sm text-[#9CA3AF] mb-6">
            {shown
              ? `ต้นไม้ที่ปลูกกักเก็บคาร์บอนถึงปริมาณที่ต้องชดเชยในปีสะสมที่ ${shown.input.year}`
              : 'ปีที่ 1 ถึงปีสะสมที่เลือก เทียบกับปริมาณที่ต้องชดเชย'}
          </p>

          {!shown && (
            <p className="text-center text-[#9CA3AF] py-20">
              เลือกคาร์บอนฟุตพรินต์ด้านซ้ายแล้วกด &quot;บันทึกและแสดงกราฟ&quot;
            </p>
          )}

          {shown && (
            <ResultPanel shown={shown} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ข้อความแบ่งแปลง ---------- */
// เพดานแปลงย่อยแบบคำพูด เช่น "ไม่เกิน 30 ไร่" (ตามเงื่อนไขที่แอดมินตั้ง)
function plotLimitWords(limit: AreaLimit) {
  return `${limit.operator === '<' ? 'น้อยกว่า' : 'ไม่เกิน'} ${fmtNum(limit.value)} ไร่`;
}

/* ---------- ช่องที่ระบบเติมให้ ---------- */
function AutoField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-[#6B7280]">{label}</span>
        <span className={`text-base font-bold ${value ? 'text-[#16A34A]' : 'text-[#D1D5DB]'}`}>{value ?? '–'}</span>
      </div>
    </div>
  );
}

/* ---------- กราฟคาร์บอนสะสม ---------- */
// แสดงเฉพาะปีที่ 1 ถึงปีสะสมที่เลือก ปีก่อนหน้า = เขียวอ่อน / ปีสะสมที่เลือก = เขียวเข้ม
// ตัวเลขต้น/ไร่/แปลง และผ่านเงื่อนไขไหม อยู่ในช่องที่ระบบเติมให้ด้านซ้ายแล้ว ไม่แสดงซ้ำ
const BAR_PAST = '#BFE8CF';
const BAR_CHOSEN = '#16A34A';

function ResultPanel({ shown }: { shown: Shown }) {
  const { plan, input } = shown;
  const target = input.targetTco2e;
  const values = cumulativeByYear(plan.treesNeeded, input.year); // ปีที่ 1 ถึงปีที่เลือก
  const yMax = Math.max(values[values.length - 1], target) * 1.18; // เผื่อที่ให้ตัวเลขบนแท่ง
  const pct = (v: number) => (v / yMax) * 100;

  return (
    <div className="rounded-2xl bg-[#F9FAFB] px-6 pt-8 pb-5">
      <div className="relative h-[300px]">
        {/* แท่ง + ตัวเลขบนแท่ง */}
        <div className="absolute inset-0 z-10 flex items-end justify-around gap-4 border-b border-[#E5E7EB]">
          {values.map((v, i) => {
            const isChosen = i + 1 === input.year;
            return (
              <div key={i} className="flex h-full max-w-[96px] flex-1 flex-col items-center justify-end">
                <span className={`mb-2 text-sm tabular-nums ${isChosen ? 'font-bold text-[#1F2937]' : 'text-[#6B7280]'}`}>
                  {fmtNum(Math.round(v))}
                </span>
                <div
                  className="w-full rounded-t-xl"
                  style={{ height: `${pct(v)}%`, backgroundColor: isChosen ? BAR_CHOSEN : BAR_PAST }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ปี */}
      <div className="mt-3 flex justify-around gap-4">
        {values.map((_, i) => (
          <span
            key={i}
            className={`max-w-[96px] flex-1 text-center text-sm ${i + 1 === input.year ? 'font-semibold text-[#16A34A]' : 'text-[#9CA3AF]'}`}
          >
            ปีที่ {i + 1}
          </span>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-[#9CA3AF]">หน่วย tCO2e สะสม</p>
    </div>
  );
}

