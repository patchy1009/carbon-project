// หน้าจำลองโครงการ T-VER จากเป้าหมายการกักเก็บคาร์บอน (แบบใหม่)
//   องค์กรกรอก: ชื่อโครงการ เป้าหมาย (tCO2e) ปีที่ต้องการให้ถึงเป้า พันธุ์ไม้ ระยะปลูก และแปลงที่มี
//   ระบบแสดง: ต้องปลูกกี่ต้น ที่ดินที่มีพอไหม ถ้าไม่พอต้องเพิ่มพื้นที่อีกกี่ไร่ (แยกทีละพันธุ์ ให้เลือกปลูกเพิ่มพันธุ์ใดพันธุ์หนึ่ง)
//   สูตรทั้งหมดอยู่ที่ src/lib/tverTargetPlan.ts / ไม่แตะหน้า tver-simulation (แบบเดิม)
//
// normalize / validate (ใช้กฎกลางของระบบใน lib/validation.ts)
//   1) ชื่อโครงการ: ห้ามว่าง / ตัวเลขล้วน / เกิน 150 ตัวอักษร / คล้ายคำสั่ง SQL
//   2) เป้าหมาย: ตัวเลข > 0 ทศนิยมไม่เกิน 2 หลัก / ปี: 1-10
//   3) พันธุ์ไม้: ต้องเลือก ต้องมีอยู่จริงใน tree_list และห้ามซ้ำในแผนเดียวกัน
//   4) ระยะปลูก: ไม่น้อยกว่า 1 ม. / ขนาดแปลง: > 0 และตามเงื่อนไขแปลงย่อยของแอดมิน (ค่าเริ่มต้น <= 30 ไร่) / จำนวนแปลง: จำนวนเต็ม > 0
//   5) พื้นที่รวมทุกพันธุ์ตามเงื่อนไขพื้นที่โครงการของแอดมิน (ค่าเริ่มต้น <= 1,000 ไร่)
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Select from '@/components/Select';
import FieldError from '@/components/FieldError';
import { supabase } from '@/lib/supabaseClient';
import {
  validateForm, required, requiredSelect, notNumericOnly, maxLength, isDecimal, isPositiveInteger, existsIn,
  meetsCondition, type formSchema, type fieldRule,
} from '@/lib/validation';
import { noSqlSyntax } from '@/lib/sqlSyntax';
import { normalizeNumberString, normalizeToArabicNumber, formatCondition } from '@/lib/normalization';
import { dbErrorMessage } from '@/lib/supabaseCrud';
import { showConfirm, showError } from '@/lib/dialog';
import { TVER_AREA_NAME, type TreeListItem, type TverProjectDetail } from '@/types/tver-project';
import {
  TVER_SUBPLOT_NAME, type OrgTreeTargetPlan, type OrgTreeTargetSpecies, type SavedTargetPlanOption,
} from '@/types/tver-target';
import {
  calculateTargetPlan, upperLimitFrom, TVER_DEFAULT_MAX_PLOT_RAI, TVER_DEFAULT_MAX_PROJECT_RAI,
  TARGET_YEAR_MIN, TARGET_YEAR_MAX, TARGET_YEAR_DEFAULT, DEFAULT_SPACING_M, MIN_SPACING_M,
  type AreaLimit, type PlanInput, type PlanResult,
} from '@/lib/tverTargetPlan';

// เพดานตามชนิดคอลัมน์ในตาราง (numeric(12,2) / numeric(5,2) / numeric(6,2))
const MAX_TARGET = 9999999999.99;
const MAX_SPACING_M = 999.99;
const MAX_PLOT_SIZE = 9999.99;

const YEAR_OPTIONS = Array.from({ length: TARGET_YEAR_MAX - TARGET_YEAR_MIN + 1 }, (_, i) => TARGET_YEAR_MIN + i);

type PlotRow = { uid: string; size: string; count: string };
type SpeciesRow = { uid: string; treeId: string; spacingTree: string; spacingRow: string; plots: PlotRow[] };
type TopField = 'projectName' | 'target' | 'year';
// ผลที่แสดงอยู่ + ค่าที่ใช้คำนวณ (ผลไม่เปลี่ยนตามฟอร์มจนกว่าจะกดคำนวณใหม่)
type Shown = { plan: PlanResult; input: PlanInput };

// id ของแถวในฟอร์ม (ใช้เป็น key ของ React และ key ของ error)
let uidSeq = 0;
const newUid = () => `row-${++uidSeq}`;
const emptyPlot = (): PlotRow => ({ uid: newUid(), size: '', count: '' });
const emptySpecies = (): SpeciesRow => ({
  uid: newUid(),
  treeId: '',
  spacingTree: String(DEFAULT_SPACING_M),
  spacingRow: String(DEFAULT_SPACING_M),
  plots: [emptyPlot()],
});

// แปลงข้อมูลที่บันทึกไว้กลับเป็นแถวในฟอร์ม (เรียงตามลำดับที่กรอก)
function rowsFromSaved(list: OrgTreeTargetSpecies[]): SpeciesRow[] {
  if (list.length === 0) return [emptySpecies()];
  return [...list]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => {
      const plots = [...(s.org_tree_target_plot ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      return {
        uid: newUid(),
        treeId: s.tree_id,
        spacingTree: String(Number(s.spacing_tree_m)),
        spacingRow: String(Number(s.spacing_row_m)),
        plots: plots.length
          ? plots.map((p) => ({ uid: newUid(), size: String(Number(p.plot_size_rai)), count: String(p.plot_count) }))
          : [emptyPlot()],
      };
    });
}

// ค่าตัวเลขเป็นหน่วยละ 0.01 (เทียบเงื่อนไขแบบไม่มีปัญหาทศนิยม)
const centi = (n: number) => Math.round(n * 100);

// พื้นที่รวม (หน่วยละ 0.01 ไร่) นับเฉพาะแถวที่กรอกถูกรูปแบบแล้ว ใช้แสดงระหว่างกรอกและตรวจเงื่อนไขพื้นที่โครงการ
function totalAreaCenti(rows: SpeciesRow[]): number {
  let sum = 0;
  for (const s of rows) {
    for (const p of s.plots) {
      const size = normalizeToArabicNumber(p.size);
      const count = normalizeToArabicNumber(p.count);
      if (size !== null && size > 0 && count !== null && Number.isInteger(count) && count > 0) sum += centi(size) * count;
    }
  }
  return sum;
}

// กฎ: ค่าต้องอยู่ในเงื่อนไขของแอดมิน เช่น ขนาดแปลง <= 30 ไร่
const withinLimit = (label: string, limit: AreaLimit, unit: string): fieldRule => (value) => {
  const n = normalizeToArabicNumber(value);
  if (n === null) return { ok: true };
  return meetsCondition(centi(n), limit.operator, centi(limit.value))
    ? { ok: true }
    : { ok: false, message: `${label}ต้อง ${formatCondition(limit.operator, limit.value, unit)} ตามเงื่อนไขโครงการ T-VER` };
};

// ตรวจค่าเดียวตามลำดับกฎ คืนข้อความ error ข้อแรก ('' = ผ่าน)
function firstError(value: string, rules: fieldRule[]): string {
  for (const rule of rules) {
    const r = rule(value);
    if (!r.ok) return r.message;
  }
  return '';
}

const fmtInt = (n: number) => n.toLocaleString('th-TH');
const fmt2 = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

export default function TverTargetClient({
  orgId,
  trees,
  criteria,
  savedPlans = [],
  existingPlan = null,
  existingSpecies = [],
}: {
  orgId: string; // auth.uid() ของบัญชีที่ล็อกอิน
  trees: TreeListItem[];
  criteria: TverProjectDetail[];
  savedPlans?: SavedTargetPlanOption[];
  existingPlan?: OrgTreeTargetPlan | null; // มีค่า = เปิดแผนที่บันทึกไว้
  existingSpecies?: OrgTreeTargetSpecies[];
}) {
  // เพดานจากเงื่อนไขที่แอดมินตั้ง (ไม่มี -> ค่าตามเกณฑ์ T-VER)
  const plotLimit = upperLimitFrom(criteria, TVER_SUBPLOT_NAME, TVER_DEFAULT_MAX_PLOT_RAI);
  const projectLimit = upperLimitFrom(criteria, TVER_AREA_NAME, TVER_DEFAULT_MAX_PROJECT_RAI);
  const treeIds = trees.map((t) => t.tree_id);
  const treeName = (id: string) => trees.find((t) => t.tree_id === id)?.tree_name ?? '-';

  const [projectName, setProjectName] = useState(existingPlan?.project_name ?? '');
  const [target, setTarget] = useState(existingPlan ? String(Number(existingPlan.target_tco2e)) : '');
  const [year, setYear] = useState(String(existingPlan?.target_year ?? TARGET_YEAR_DEFAULT));
  const [species, setSpecies] = useState<SpeciesRow[]>(() => rowsFromSaved(existingSpecies));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedPlanId, setSavedPlanId] = useState<string | null>(existingPlan?.targetplan_id ?? null);
  const [saving, setSaving] = useState(false);

  // เปิดแผนที่บันทึกไว้ -> แสดงผลทันทีจากค่าที่บันทึก (คำนวณใหม่ด้วยสูตรเดียวกัน)
  const [shown, setShown] = useState<Shown | null>(() => {
    if (!existingPlan || existingSpecies.length === 0) return null;
    const input: PlanInput = {
      targetTco2e: Number(existingPlan.target_tco2e),
      year: existingPlan.target_year,
      maxProjectArea: projectLimit,
      species: [...existingSpecies]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({
          key: s.tree_id,
          name: treeName(s.tree_id),
          spacingTreeM: Number(s.spacing_tree_m),
          spacingRowM: Number(s.spacing_row_m),
          plots: (s.org_tree_target_plot ?? []).map((p) => ({ sizeRai: Number(p.plot_size_rai), count: p.plot_count })),
        })),
    };
    return { plan: calculateTargetPlan(input), input };
  });

  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  /* ---------- แก้แถวในฟอร์ม (สร้าง array ใหม่ทุกครั้ง ไม่แก้ของเดิม) ---------- */
  function updateSpecies(uid: string, patch: Partial<Pick<SpeciesRow, 'treeId' | 'spacingTree' | 'spacingRow'>>) {
    setSpecies((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  }
  function updatePlot(spUid: string, plotUid: string, patch: Partial<Pick<PlotRow, 'size' | 'count'>>) {
    setSpecies((prev) =>
      prev.map((s) =>
        s.uid !== spUid ? s : { ...s, plots: s.plots.map((p) => (p.uid === plotUid ? { ...p, ...patch } : p)) }
      )
    );
  }
  const addSpecies = () => setSpecies((prev) => [...prev, emptySpecies()]);
  const removeSpecies = (uid: string) => setSpecies((prev) => prev.filter((s) => s.uid !== uid));
  const addPlot = (spUid: string) =>
    setSpecies((prev) => prev.map((s) => (s.uid === spUid ? { ...s, plots: [...s.plots, emptyPlot()] } : s)));
  const removePlot = (spUid: string, plotUid: string) =>
    setSpecies((prev) =>
      prev.map((s) => (s.uid === spUid ? { ...s, plots: s.plots.filter((p) => p.uid !== plotUid) } : s))
    );

  // เลือกแผนจาก dropdown: ค่าว่าง = แผนใหม่ / id = เปิดแผนนั้น (โหลดหน้าใหม่ทั้งหน้า แบบเดียวกับหน้าแบบเดิม)
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
      year: { rules: [requiredSelect('ปีที่ต้องการให้ถึงเป้าหมาย'), existsIn('ปี', YEAR_OPTIONS.map(String))] },
    };
    const top = validateForm<TopField>({ projectName, target, year }, schema);
    const errs: Record<string, string> = {};
    if (!top.ok) for (const [k, m] of Object.entries(top.errors)) if (m) errs[k] = m;

    if (species.length === 0) errs.species = 'กรุณาเพิ่มพันธุ์ไม้อย่างน้อย 1 พันธุ์';

    species.forEach((s, i) => {
      // พันธุ์ไม้: ต้องเลือก มีอยู่จริง และห้ามซ้ำกับแถวก่อนหน้า
      let treeErr = firstError(s.treeId, [requiredSelect('พันธุ์ไม้'), existsIn('พันธุ์ไม้', treeIds)]);
      if (!treeErr && species.slice(0, i).some((o) => o.treeId === s.treeId)) treeErr = 'เลือกพันธุ์ไม้นี้ไปแล้ว';
      if (treeErr) errs[`${s.uid}:tree`] = treeErr;

      // ระยะปลูก
      const spacingRules = (label: string) => [
        required(label),
        isDecimal(label, { min: MIN_SPACING_M, maxDecimals: 2, max: MAX_SPACING_M }),
      ];
      const stErr = firstError(normalizeNumberString(s.spacingTree), spacingRules('ระยะห่างระหว่างต้น'));
      const srErr = firstError(normalizeNumberString(s.spacingRow), spacingRules('ระยะห่างระหว่างแถว'));
      if (stErr || srErr) errs[`${s.uid}:spacing`] = stErr || srErr;

      // แปลง
      if (s.plots.length === 0) errs[`${s.uid}:plots`] = 'กรุณาเพิ่มแปลงอย่างน้อย 1 กลุ่ม';
      for (const p of s.plots) {
        const sizeErr = firstError(normalizeNumberString(p.size), [
          required('ขนาดแปลง'),
          isDecimal('ขนาดแปลง', { allowZero: false, maxDecimals: 2, max: MAX_PLOT_SIZE }),
          withinLimit('ขนาดแปลง', plotLimit, 'ไร่'),
        ]);
        const countErr = firstError(normalizeNumberString(p.count), [required('จำนวนแปลง'), isPositiveInteger('จำนวนแปลง')]);
        if (sizeErr || countErr) errs[`${p.uid}:plot`] = sizeErr || countErr;
      }
    });

    // พื้นที่รวมทุกพันธุ์ตามเงื่อนไขพื้นที่โครงการ (ตรวจเมื่อแปลงทุกแถวถูกต้องแล้ว)
    const plotsOk = species.every((s) => s.plots.length > 0 && s.plots.every((p) => !errs[`${p.uid}:plot`]));
    if (plotsOk && species.length > 0) {
      const total = totalAreaCenti(species);
      if (!meetsCondition(total, projectLimit.operator, centi(projectLimit.value))) {
        errs.totalArea = `พื้นที่รวมทุกพันธุ์ ${fmtNum(total / 100)} ไร่ ไม่ผ่านเงื่อนไขพื้นที่โครงการ (${formatCondition(projectLimit.operator, projectLimit.value, 'ไร่')})`;
      }
    }

    const hasError = Object.values(errs).some((m) => m);
    if (hasError || !top.ok) return { ok: false, errors: errs };

    const num = (v: string) => normalizeToArabicNumber(v) ?? 0;
    const input: PlanInput = {
      targetTco2e: num(top.clean.target),
      year: Number(top.clean.year),
      maxProjectArea: projectLimit,
      species: species.map((s) => ({
        key: s.treeId,
        name: treeName(s.treeId),
        spacingTreeM: num(s.spacingTree),
        spacingRowM: num(s.spacingRow),
        plots: s.plots.map((p) => ({ sizeRai: num(p.size), count: num(p.count) })),
      })),
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

    let planId = savedPlanId;
    if (planId) {
      const { error } = await supabase.from('org_tree_target_plan').update(planValues).eq('targetplan_id', planId);
      if (error) { showError('อัปเดตแผนไม่สำเร็จ: ' + dbErrorMessage(error)); return false; }
      // ลบพันธุ์เดิมก่อน (แปลงถูกลบตามด้วย on delete cascade) แล้วบันทึกชุดใหม่ด้านล่าง
      const { error: delError } = await supabase.from('org_tree_target_species').delete().eq('targetplan_id', planId);
      if (delError) { showError('อัปเดตพันธุ์ไม้ไม่สำเร็จ: ' + dbErrorMessage(delError)); return false; }
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

    const { data: inserted, error: speciesError } = await supabase
      .from('org_tree_target_species')
      .insert(
        input.species.map((s, i) => ({
          targetplan_id: planId,
          tree_id: s.key,
          spacing_tree_m: s.spacingTreeM,
          spacing_row_m: s.spacingRowM,
          sort_order: i,
        }))
      )
      .select('targetspecies_id, tree_id');
    if (speciesError || !inserted) {
      showError('บันทึกพันธุ์ไม้ไม่สำเร็จ: ' + (speciesError ? dbErrorMessage(speciesError) : 'ไม่ทราบสาเหตุ'));
      return false;
    }

    // พันธุ์ไม่ซ้ำในแผนเดียวกัน จึงจับคู่แปลงกับพันธุ์ด้วย tree_id ได้
    const speciesIdByTree = new Map<string, string>(
      (inserted as { targetspecies_id: string; tree_id: string }[]).map((r) => [r.tree_id, r.targetspecies_id])
    );
    const { error: plotError } = await supabase.from('org_tree_target_plot').insert(
      input.species.flatMap((s) =>
        s.plots.map((p, j) => ({
          targetspecies_id: speciesIdByTree.get(s.key),
          plot_size_rai: p.sizeRai,
          plot_count: p.count,
          sort_order: j,
        }))
      )
    );
    if (plotError) { showError('บันทึกแปลงไม่สำเร็จ: ' + dbErrorMessage(plotError)); return false; }
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
      `ต้องการลบแผน "${projectName || 'แผนนี้'}" ใช่หรือไม่ พันธุ์ไม้และแปลงของแผนนี้จะถูกลบด้วย`,
      { danger: true }
    );
    if (!ok) return;
    const { error } = await supabase.from('org_tree_target_plan').delete().eq('targetplan_id', savedPlanId);
    if (error) return showError('ลบแผนไม่สำเร็จ: ' + dbErrorMessage(error));
    openSavedPlan('');
  }

  // dropdown แผนที่บันทึกไว้ (แผนที่เพิ่งบันทึกครั้งแรกยังไม่อยู่ในรายการจาก server จึงเติมให้)
  const planOptions = [...savedPlans];
  if (savedPlanId && !planOptions.some((p) => p.targetplan_id === savedPlanId)) {
    planOptions.push({ targetplan_id: savedPlanId, project_name: projectName || 'แผนนี้' });
  }

  const liveTotal = totalAreaCenti(species) / 100;
  const inputClass = (hasError: boolean) =>
    `w-full border rounded-xl px-3 py-3 text-base ${hasError ? 'border-red-500' : 'border-[#E5E7EB]'}`;

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      <div className="mb-6">
        <Link href="/organization/tver" className="text-sm text-[#6B7280] hover:underline">
          ‹ เลือกวิธีคำนวณ
        </Link>
        <h1 className="text-[32px] font-medium text-black">จำลองโครงการ T-VER จากเป้าหมาย</h1>
        <p className="text-base font-medium text-[#6B7280]">
          กรอกปริมาณคาร์บอนที่ต้องการกักเก็บ ระบบคำนวณว่าต้องปลูกกี่ต้น และที่ดินที่มีพอหรือไม่
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

          {planOptions.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">แผนที่บันทึกไว้</label>
              <Select
                value={savedPlanId ?? ''}
                onChange={openSavedPlan}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-3 text-base"
                options={[
                  { value: '', label: '+ สร้างแผนใหม่' },
                  ...planOptions.map((p) => ({ value: p.targetplan_id, label: p.project_name })),
                ]}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#374151]">ชื่อโครงการ</label>
            <input
              value={projectName}
              maxLength={150}
              onChange={(e) => {
                setProjectName(e.target.value);
                clearError('projectName');
              }}
              placeholder="เช่น แผนปลูกป่าชดเชยคาร์บอน ปี 2570"
              className={inputClass(!!errors.projectName)}
            />
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
              <label className="block text-sm font-semibold text-[#374151]">ให้ถึงเป้าหมายในปีที่</label>
              <Select
                value={year}
                onChange={(v) => {
                  setYear(v);
                  clearError('year');
                }}
                className={inputClass(!!errors.year)}
                options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: `ปีที่ ${y}` }))}
              />
              <FieldError message={errors.year} />
            </div>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            เลือกได้ปีที่ {TARGET_YEAR_MIN}-{TARGET_YEAR_MAX} ตามระยะคิดเครดิตโครงการป่าไม้ T-VER (ค่าเริ่มต้นปีที่ {TARGET_YEAR_DEFAULT})
          </p>

          {/* พันธุ์ไม้ ระยะปลูก และแปลง */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-[#1F2937]">พันธุ์ไม้และพื้นที่ปลูกที่มี</h3>
            {trees.length === 0 && (
              <p className="text-sm text-red-600">ยังไม่มีรายการพันธุ์ไม้ในระบบ กรุณาติดต่อผู้ดูแลระบบ</p>
            )}

            {species.map((s, i) => (
              <div key={s.uid} className="rounded-xl border border-[#E5E7EB] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#374151]">พันธุ์ไม้ที่ {i + 1}</span>
                  {species.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSpecies(s.uid)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      ลบพันธุ์นี้
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <Select
                    value={s.treeId}
                    onChange={(v) => {
                      updateSpecies(s.uid, { treeId: v });
                      clearError(`${s.uid}:tree`);
                    }}
                    className={inputClass(!!errors[`${s.uid}:tree`])}
                    options={[
                      { value: '', label: 'เลือกพันธุ์ไม้', placeholder: true },
                      ...trees.map((t) => ({ value: t.tree_id, label: t.tree_name ?? '-' })),
                    ]}
                  />
                  <FieldError message={errors[`${s.uid}:tree`]} />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-[#374151]">ระยะปลูก (เมตร)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="ระยะห่างระหว่างต้น (เมตร)"
                      value={s.spacingTree}
                      onChange={(e) => {
                        updateSpecies(s.uid, { spacingTree: e.target.value });
                        clearError(`${s.uid}:spacing`);
                      }}
                      className={inputClass(!!errors[`${s.uid}:spacing`])}
                    />
                    <span className="text-[#6B7280]">×</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="ระยะห่างระหว่างแถว (เมตร)"
                      value={s.spacingRow}
                      onChange={(e) => {
                        updateSpecies(s.uid, { spacingRow: e.target.value });
                        clearError(`${s.uid}:spacing`);
                      }}
                      className={inputClass(!!errors[`${s.uid}:spacing`])}
                    />
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    ระยะห่างระหว่างต้น × ระยะห่างระหว่างแถว (ค่าเริ่มต้น {DEFAULT_SPACING_M} × {DEFAULT_SPACING_M} ม.) ไม่ใช่ขนาดของแปลง
                  </p>
                  <FieldError message={errors[`${s.uid}:spacing`]} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#374151]">แปลงปลูก</label>
                  {s.plots.map((p) => (
                    <div key={p.uid} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label="ขนาดแปลง (ไร่)"
                          placeholder="ขนาด"
                          value={p.size}
                          onChange={(e) => {
                            updatePlot(s.uid, p.uid, { size: e.target.value });
                            clearError(`${p.uid}:plot`);
                            clearError('totalArea');
                          }}
                          className={inputClass(!!errors[`${p.uid}:plot`])}
                        />
                        <span className="shrink-0 text-sm text-[#6B7280]">ไร่ ×</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="จำนวนแปลง"
                          placeholder="จำนวน"
                          value={p.count}
                          onChange={(e) => {
                            updatePlot(s.uid, p.uid, { count: e.target.value });
                            clearError(`${p.uid}:plot`);
                            clearError('totalArea');
                          }}
                          className={inputClass(!!errors[`${p.uid}:plot`])}
                        />
                        <span className="shrink-0 text-sm text-[#6B7280]">แปลง</span>
                        {s.plots.length > 1 && (
                          <button
                            type="button"
                            aria-label="ลบกลุ่มแปลงนี้"
                            onClick={() => removePlot(s.uid, p.uid)}
                            className="shrink-0 px-2 text-lg text-[#9CA3AF] hover:text-red-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <FieldError message={errors[`${p.uid}:plot`]} />
                    </div>
                  ))}
                  <FieldError message={errors[`${s.uid}:plots`]} />
                  <button
                    type="button"
                    onClick={() => addPlot(s.uid)}
                    className="text-sm font-semibold text-[#2d4a63] hover:underline"
                  >
                    + เพิ่มกลุ่มแปลง
                  </button>
                  <p className="text-xs text-[#9CA3AF]">
                    เงื่อนไข: แต่ละแปลง {formatCondition(plotLimit.operator, plotLimit.value, 'ไร่')}
                  </p>
                </div>
              </div>
            ))}

            <FieldError message={errors.species} />
            <button type="button" onClick={addSpecies} className="btn btn-create w-full rounded-xl py-3 text-base font-semibold">
              + เพิ่มพันธุ์ไม้
            </button>

            <div className="rounded-xl bg-[#F9FAFB] px-4 py-3 text-sm text-[#374151]">
              พื้นที่รวมทุกพันธุ์: <span className="font-semibold">{fmtNum(liveTotal)} ไร่</span>
              <span className="text-[#9CA3AF]">
                {' '}
                (เงื่อนไข: {formatCondition(projectLimit.operator, projectLimit.value, 'ไร่')})
              </span>
            </div>
            <FieldError message={errors.totalArea} />
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
          <p className="text-sm text-[#9CA3AF] mb-6">คำนวณตามสูตรของ T-VER (MAI 9.5 kgCO2/ต้น/ปี)</p>

          {!shown && (
            <p className="text-center text-[#9CA3AF] py-20">
              กรอกข้อมูลด้านซ้ายแล้วกด &quot;บันทึกและคำนวณ&quot; เพื่อดูผลลัพธ์
            </p>
          )}

          {shown && (
            <ResultPanel
              shown={shown}
              projectLimit={projectLimit}
              plotLimit={plotLimit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- แผงผลลัพธ์ ---------- */
function ResultPanel({ shown, projectLimit, plotLimit }: { shown: Shown; projectLimit: AreaLimit; plotLimit: AreaLimit }) {
  const { plan, input } = shown;
  const limitText = formatCondition(projectLimit.operator, projectLimit.value, 'ไร่');

  return (
    <div className="space-y-6">
      {/* ตัวเลขหลัก */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="ต้องปลูกตามเป้าหมาย" value={fmtInt(plan.treesNeeded)} unit="ต้น" />
        <Stat label="ที่ดินที่มีปลูกได้" value={fmtInt(plan.treesCapacity)} unit={`ต้น บนพื้นที่ ${fmtNum(plan.areaRai)} ไร่`} />
        <Stat label={`กักเก็บได้จริงในปีที่ ${input.year}`} value={fmt2(plan.carbonCapacity)} unit="tCO2e" />
      </div>

      {/* ผลต่าง = เป้าหมาย − ที่ทำได้จริง */}
      {plan.isSufficient ? (
        <div className="rounded-xl border border-[#BBE5CF] bg-[#F2F8F5] p-4 text-[#18794a]">
          <p className="font-semibold">ที่ดินพอ ปลูกได้ถึงเป้าหมาย {fmt2(input.targetTco2e)} tCO2e</p>
          <p className="mt-1 text-sm">
            {plan.carbonGap < 0 ? `ปลูกได้เกินเป้าหมาย ${fmt2(-plan.carbonGap)} tCO2e ` : ''}
            ต้องปลูกอย่างน้อย {fmtInt(plan.treesNeeded)} ต้นจึงจะถึงเป้าหมายในปีที่ {input.year}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">ที่ดินไม่พอ ยังขาดอีก {fmt2(plan.carbonGap)} tCO2e</p>
          <p className="mt-1 text-sm">ต้องปลูกเพิ่มอีก {fmtInt(plan.treesShort)} ต้น</p>
        </div>
      )}

      {/* รายพันธุ์ */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
              <th className="py-2 pr-3 font-semibold">พันธุ์ไม้</th>
              <th className="py-2 pr-3 font-semibold">ระยะปลูก (ม.)</th>
              <th className="py-2 pr-3 text-right font-semibold">พื้นที่ (ไร่)</th>
              <th className="py-2 text-right font-semibold">ปลูกได้ (ต้น)</th>
            </tr>
          </thead>
          <tbody>
            {plan.species.map((s, i) => (
              <tr key={s.key} className="border-b border-[#F3F4F6]">
                <td className="py-2 pr-3">{s.name}</td>
                <td className="py-2 pr-3">
                  {fmtNum(input.species[i].spacingTreeM)} × {fmtNum(input.species[i].spacingRowM)}
                </td>
                <td className="py-2 pr-3 text-right">{fmtNum(s.areaRai)}</td>
                <td className="py-2 text-right">{fmtInt(s.treesCapacity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ที่ดินไม่พอ: ต้องเพิ่มพื้นที่เท่าไหร่ (เลือกปลูกเพิ่มพันธุ์ใดพันธุ์หนึ่ง) */}
      {!plan.isSufficient && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-[#1F2937]">ต้องเพิ่มพื้นที่ปลูกเท่าไหร่</h3>
          <p className="text-sm text-[#6B7280]">เลือกปลูกเพิ่มพันธุ์ใดพันธุ์หนึ่ง (คิดจากระยะปลูกของพันธุ์นั้น)</p>
          <ul className="space-y-2">
            {/* ทางเลือกที่ผ่านเงื่อนไขขึ้นก่อน ที่เกินเพดานต่อท้ายเป็นหมายเหตุ */}
            {[...plan.species].sort((a, b) => Number(b.withinLimit) - Number(a.withinLimit)).map((s) =>
              s.withinLimit ? (
                <li key={s.key} className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="font-semibold text-[#1F2937]">
                    ปลูก{s.name}เพิ่มอีก {fmtInt(s.addRai ?? 0)} ไร่
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    พื้นที่รวมเป็น {fmtNum(s.totalRaiAfterAdd ?? 0)} ไร่ ผ่านเงื่อนไขพื้นที่โครงการ ({limitText})
                  </p>
                </li>
              ) : (
                <li key={s.key} className="rounded-xl border border-dashed border-[#E5E7EB] p-3 text-sm text-[#9CA3AF]">
                  {s.name}: ต้องเพิ่ม {fmtInt(s.addRai ?? 0)} ไร่ ทำให้พื้นที่รวมเป็น {fmtNum(s.totalRaiAfterAdd ?? 0)} ไร่
                  เกินเงื่อนไขพื้นที่โครงการ ({limitText})
                </li>
              )
            )}
          </ul>

          {plan.hasFeasibleOption ? (
            <p className="text-sm text-[#6B7280]">
              แบ่งแปลงเองได้ แต่ละแปลง {formatCondition(plotLimit.operator, plotLimit.value, 'ไร่')} แล้วกรอกแปลงที่เพิ่มในฟอร์มเพื่อคำนวณใหม่
            </p>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">ทุกพันธุ์ทำให้พื้นที่โครงการเกินเงื่อนไข ({limitText}) ลองปรับแล้วคำนวณใหม่</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>ลดเป้าหมายการกักเก็บคาร์บอน</li>
                {input.year < TARGET_YEAR_MAX && (
                  <li>เลือกปีที่ไกลขึ้น (สูงสุดปีที่ {TARGET_YEAR_MAX}) ต้นไม้จะกักเก็บได้มากขึ้นตามเวลา</li>
                )}
                <li>ลดระยะปลูก ถ้าพันธุ์ไม้นั้นปลูกถี่ได้</li>
              </ul>
            </div>
          )}
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
