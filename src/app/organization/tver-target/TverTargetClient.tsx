// หน้าจำลองโครงการ T-VER จากการกักเก็บก๊าซเรือนกระจก (แบบใหม่)
//   องค์กรกรอก: ชื่อโครงการ เป้าหมาย (tCO2e) และปีสะสม
//   ระบบแสดง: ต้องปลูกกี่ต้น ต้องใช้พื้นที่กี่ไร่ (ระยะปลูกมาตรฐาน 4 × 4 ม.) และผ่านเงื่อนไขพื้นที่โครงการไหม
//   สูตรทั้งหมดอยู่ที่ calculation.ts (โฟลเดอร์เดียวกัน) / ไม่แตะหน้า tver-simulation (แบบเดิม)
//
// normalize / validate (ใช้กฎกลางของระบบใน lib/validation.ts)
//   1) ชื่อโครงการ: ห้ามว่าง / ตัวเลขล้วน / เกิน 150 ตัวอักษร / คล้ายคำสั่ง SQL
//   2) เป้าหมาย: ตัวเลข > 0 ทศนิยมไม่เกิน 2 หลัก / ปีสะสม: 1-10
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
import { normalizeNumberString, normalizeToArabicNumber, normalizeForCompare, formatCondition } from '@/lib/normalization';
import { dbErrorMessage } from '@/lib/supabaseCrud';
import { showConfirm, showError } from '@/lib/dialog';
import { TVER_AREA_NAME, type TverProjectDetail } from '@/types/tver-project';
import { TVER_SUBPLOT_NAME, type OrgTreeTargetPlan, type SavedTargetPlanOption } from '@/types/tver-target';
import {
  calculateTargetPlan, upperLimitFrom, TVER_DEFAULT_MAX_PLOT_RAI, TVER_DEFAULT_MAX_PROJECT_RAI,
  TARGET_YEAR_MIN, TARGET_YEAR_MAX, TARGET_YEAR_DEFAULT, STANDARD_SPACING_M,
  type AreaLimit, type PlanInput, type PlanResult,
} from './calculation';

// เพดานตามชนิดคอลัมน์ในตาราง (numeric(12,2))
const MAX_TARGET = 9999999999.99;

const YEAR_OPTIONS = Array.from({ length: TARGET_YEAR_MAX - TARGET_YEAR_MIN + 1 }, (_, i) => TARGET_YEAR_MIN + i);

type TopField = 'projectName' | 'target' | 'year';
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
}: {
  orgId: string; // auth.uid() ของบัญชีที่ล็อกอิน
  criteria: TverProjectDetail[];
  savedPlans?: SavedTargetPlanOption[];
  existingPlan?: OrgTreeTargetPlan | null; // มีค่า = เปิดแผนที่บันทึกไว้
}) {
  // เพดานจากเงื่อนไขที่แอดมินตั้ง (ไม่มี -> ค่าตามเกณฑ์ T-VER)
  const plotLimit = upperLimitFrom(criteria, TVER_SUBPLOT_NAME, TVER_DEFAULT_MAX_PLOT_RAI);
  const projectLimit = upperLimitFrom(criteria, TVER_AREA_NAME, TVER_DEFAULT_MAX_PROJECT_RAI);

  const [projectName, setProjectName] = useState(existingPlan?.project_name ?? '');
  const [target, setTarget] = useState(existingPlan ? String(Number(existingPlan.target_tco2e)) : '');
  const [year, setYear] = useState(String(existingPlan?.target_year ?? TARGET_YEAR_DEFAULT));
  const [errors, setErrors] = useState<Record<string, string>>({});
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
    };
    return { plan: calculateTargetPlan(input), input };
  });

  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // เลือกแผนจากรายการใต้ช่องชื่อโครงการ: ค่าว่าง = แผนใหม่ / id = เปิดแผนนั้น (โหลดหน้าใหม่ทั้งหน้า แบบเดียวกับหน้าแบบเดิม)
  function openSavedPlan(id: string) {
    window.location.assign(id ? `/organization/tver-target?edit=${encodeURIComponent(id)}` : '/organization/tver-target');
  }

  /* ---------- ตรวจทั้งฟอร์ม แล้วคืนค่าที่พร้อมคำนวณ ---------- */
  function validateAll():
    | { ok: true; errors: Record<string, string>; clean: Record<TopField, string>; input: PlanInput }
    | { ok: false; errors: Record<string, string> } {
    const schema: formSchema<TopField> = {
      projectName: {
        rules: [required('ชื่อโครงการ'), notNumericOnly('ชื่อโครงการ'), maxLength('ชื่อโครงการ', 150), noSqlSyntax('ชื่อโครงการ')],
      },
      target: {
        normalize: normalizeNumberString,
        rules: [
          required('เป้าหมายการกักเก็บคาร์บอน'),
          isDecimal('เป้าหมายการกักเก็บคาร์บอน', { allowZero: false, maxDecimals: 2, max: MAX_TARGET }),
        ],
      },
      year: { rules: [requiredSelect('ปีที่สะสม'), existsIn('ปี', YEAR_OPTIONS.map(String))] },
    };
    const top = validateForm<TopField>({ projectName, target, year }, schema);
    const errs: Record<string, string> = {};
    if (!top.ok) for (const [k, m] of Object.entries(top.errors)) if (m) errs[k] = m;

    const hasError = Object.values(errs).some((m) => m);
    if (hasError || !top.ok) return { ok: false, errors: errs };

    const num = (v: string) => normalizeToArabicNumber(v) ?? 0;
    const input: PlanInput = {
      targetTco2e: num(top.clean.target),
      year: Number(top.clean.year),
      maxProjectArea: projectLimit,
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

  // กดปุ่ม "บันทึกและคำนวณ": ตรวจ -> คำนวณแล้วแสดงผลทันที -> บันทึก
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
          กรอกปริมาณคาร์บอนที่ต้องการกักเก็บ ระบบคำนวณว่าต้องปลูกกี่ต้น และต้องใช้พื้นที่เท่าไหร่
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">เป้าหมายการกักเก็บ (tCO2e)</label>
              <input
                type="text"
                inputMode="decimal"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  clearError('target');
                }}
                placeholder="เช่น 1000"
                className={inputClass(!!errors.target)}
              />
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-[239px] h-[60px] rounded-[20px] text-base font-semibold"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกและคำนวณ'}
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
          <h2 className="text-xl font-bold text-[#1F2937]">ผลการคำนวณ</h2>

          {!shown && (
            <p className="text-center text-[#9CA3AF] py-20">
              กรอกข้อมูลด้านซ้ายแล้วกด &quot;บันทึกและคำนวณ&quot; เพื่อดูผลลัพธ์
            </p>
          )}

          {shown && (
            <ResultPanel
              shown={shown}
              plotLimit={plotLimit}
              projectLimit={projectLimit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- แผงผลลัพธ์ ---------- */
function ResultPanel({ shown, plotLimit, projectLimit }: { shown: Shown; plotLimit: AreaLimit; projectLimit: AreaLimit }) {
  const { plan, input } = shown;
  // ขนาดแปลงสูงสุดแบบคำพูด เช่น "ไม่เกิน 30 ไร่" (ตามเงื่อนไขที่แอดมินตั้ง)
  const plotLimitWords = `${plotLimit.operator === '<' ? 'น้อยกว่า' : 'ไม่เกิน'} ${fmtNum(plotLimit.value)} ไร่`;

  return (
    <div className="space-y-6">
      {/* ตัวเลขหลัก */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="จำนวนต้นไม้ที่ต้องปลูก" value={fmtInt(plan.treesNeeded)} unit={`ต้น ในปีสะสมที่ ${input.year}`} />
        <Stat
          label="พื้นที่ที่ต้องใช้"
          value={fmtInt(plan.areaRai)}
          unit={`ไร่ (ระยะปลูก ${STANDARD_SPACING_M} × ${STANDARD_SPACING_M} ม.`}
        />
      </div>

      {/* เงื่อนไขพื้นที่โครงการ */}
      {plan.withinLimit ? (
        <div className="rounded-xl border border-[#BBE5CF] bg-[#F2F8F5] p-4 text-[#18794a]">
          <p className="font-semibold">ผ่านเงื่อนไขพื้นที่โครงการ ปลูกได้ถึงเป้าหมาย {fmt2(input.targetTco2e)} tCO2e</p>
          <p className="mt-1 text-sm">สามารถแบ่งแปลงเองได้ โดยแต่ละแปลงขนาด{plotLimitWords}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">พื้นที่ {fmtInt(plan.areaRai)} ไร่ เกินเงื่อนไขพื้นที่โครงการ</p>
          <p className="mt-1 text-sm">
            เงื่อนไขพื้นที่โครงการ {formatCondition(projectLimit.operator, projectLimit.value, 'ไร่')}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl p-4 text-center space-y-1">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className="text-2xl font-bold text-[#16A34A]">{value}</p>
      <p className="text-[11px] text-[#9CA3AF]">{unit}</p>
    </div>
  );
}
