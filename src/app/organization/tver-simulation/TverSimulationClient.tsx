// หน้าจำลองโครงการปลูกป่า T-VER: กรอกข้อมูล ตรวจเงื่อนไข คำนวณเครดิต และบันทึกโครงการ
'use client';

import Select, { ChevronDown } from '@/components/Select'; // dropdown กลาง (แทน <select> ของ browser ให้หน้าตาเหมือนกันทั้งระบบ)
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // dropdown "โครงการที่บันทึกไว้" -> เปิดหน้าของโครงการนั้น
import { calculateTverCredits } from '@/lib/tverCredits'; // [MERGE aom + cyn2] สูตรเครดิตของ cyn2
import { supabase } from '@/lib/supabaseClient';
import { TVER_TREE_COUNT_NAME, type TreeListItem, type TverProjectDetail } from '@/types/tver-project';
import type { OrgTreeProject, OrgTreeProjectDetail } from '@/types/tver-simulation';
import {
  validateForm, required, requiredSelect, notNumericOnly, maxLength, isDecimal, isDate, existsIn,
  meetsCondition, type formSchema,
} from '@/lib/validation';
import { normalizeNumberString, normalizeToArabicNumber, formatCondition } from '@/lib/normalization';
import { dbErrorMessage } from '@/lib/supabaseCrud';
import { showError } from '@/lib/dialog'; // กล่องแจ้งเตือนกลางแทน alert

/* normalize / validate ฟอร์มจำลองโครงการ T-VER
 * 1) ชื่อโครงการ: ห้ามว่าง / ตัวเลขล้วน / ยาวเกิน 150 ตัวอักษร
 * 2) พันธุ์ไม้: ต้องเลือก และต้องมีอยู่จริงใน tree_list (ตรวจความสัมพันธ์)
 * 3) ค่าของแต่ละเงื่อนไข: แปลงเลขไทย/ลบ comma, ไม่ติดลบ (เดิม parseFloat รับ "12abc" และค่าติดลบได้)
 * 4) เทียบค่าที่กรอกกับเงื่อนไขที่แอดมินตั้ง เช่น พื้นที่ "<= 1000" ไร่ กรอก 1200 -> แจ้งว่าไม่ผ่าน
 * 5) วันที่เริ่มโครงการ: ต้องเป็นวันที่ที่มีอยู่จริง และอยู่ในช่วงปีที่สมเหตุสมผล
 * 6) error แสดงใต้ช่อง แทนการพึ่ง required ของ browser */

// ปีที่ยอมให้เลือกเป็นวันเริ่มโครงการ (ค.ศ.)
const MIN_START_YEAR = 2000;
const MAX_START_YEAR = new Date().getFullYear() + 10;


/* [MERGE aom + cyn2] แบ่งงานหน้า T-VER
 *   หน้านี้ (aom)          : กรอกข้อมูลโครงการ + ตรวจกับเงื่อนไขที่แอดมินตั้ง + บันทึก แล้วแสดงกราฟเครดิตในหน้าเดิม
 *                            เครดิตคำนวณด้วยสูตรของ cyn2 (lib/tverCredits.ts = T-VER สูตรที่ 4)
 *   tver_simulation (cyn2) : จัดสรรเครดิต -> ภาษี (กดปุ่ม "ไปจัดสรรคาร์บอนเครดิต" ใต้กราฟ)
 *   [ลบ] สูตรเดิมของ aom (T × 10 ÷ 1000, ×1.18, ×1.38 ค่าสมมติ) */

type CreditResult = { year1: number; year2: number; year3: number };

// โครงการที่องค์กรบันทึกไว้ (ใช้แค่ id + ชื่อ แสดงใน dropdown)
export type SavedProjectOption = { orgtreeproject_id: string; project_name: string | null };

// หน้าจอหลัก รองรับทั้งโครงการใหม่ และการแก้ไขโครงการเดิม
export default function TverSimulationClient({
  orgId,
  trees,
  criteria,
  existingProject = null,
  existingDetails = [],
  savedProjects = [],
}: {
  orgId: string; // auth.uid() ของบัญชีที่ล็อกอิน
  trees: TreeListItem[];
  criteria: TverProjectDetail[];
  existingProject?: OrgTreeProject | null; // ถ้ามีค่า = โหมดแก้ไขโครงการเดิม
  existingDetails?: OrgTreeProjectDetail[];
  savedProjects?: SavedProjectOption[]; // โครงการที่บันทึกไว้ขององค์กรนี้ (page.tsx ดึงมา)
}) {
  const isEditMode = existingProject !== null;
  const router = useRouter();

  // เลือกจาก dropdown: ค่าว่าง = เริ่มโครงการใหม่ / id = เปิดโครงการนั้น (/tver-simulation?edit=<id>)
  function openSavedProject(id: string) {
    router.push(id ? `/organization/tver-simulation?edit=${encodeURIComponent(id)}` : '/organization/tver-simulation');
  }

  // รายการใต้ช่องชื่อโครงการ: null = ปิด / 'filter' = กรองตามที่พิมพ์ / 'all' = ทั้งหมด (กดปุ่มลูกศร)
  const [listMode, setListMode] = useState<'filter' | 'all' | null>(null);

  // ค่าเริ่มต้นของฟอร์ม: โหมดแก้ไขจะดึงจากโครงการเดิม โหมดสร้างใหม่จะว่างเปล่า
  const [projectName, setProjectName] = useState(existingProject?.project_name ?? '');

  // โครงการที่แสดงในรายการใต้ช่องชื่อ (ไม่รวมโครงการที่เปิดอยู่)
  const otherProjects = savedProjects.filter((p) => p.orgtreeproject_id !== existingProject?.orgtreeproject_id);
  const query = projectName.trim().toLowerCase();
  // ถ้าชื่อในช่องยังเป็นชื่อเดิมของโครงการที่เปิดอยู่ ถือว่ายังไม่ได้พิมพ์ค้น -> แสดงทั้งหมด
  const isSearching = query !== '' && query !== (existingProject?.project_name ?? '').trim().toLowerCase();
  const shownProjects =
    listMode === 'filter' && isSearching
      ? otherProjects.filter((p) => (p.project_name ?? '').toLowerCase().includes(query))
      : otherProjects;

  // พันธุ์ไม้เก็บอยู่ในแถวรายละเอียดของโครงการ (org_tree_project_detail.tree_id) ทุกแถวมีค่าเดียวกัน
  const [treeId, setTreeId] = useState(existingDetails.find((d) => d.tree_id)?.tree_id ?? '');

  // [แก้ไข] ลบ join_year แล้ว ทุกโครงการมี join_date (schema_cleanup.sql เติมให้รายการเก่า)
  const [startDate, setStartDate] = useState(existingProject?.join_date ?? '');

  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const d of existingDetails) {
      if (d.tverdetail_id && d.amount !== null) initial[d.tverdetail_id] = String(d.amount);
    }
    return initial;
  });

  // ผลเครดิต 3 ปี (โหมดแก้ไขเริ่มจากค่าที่บันทึกไว้)
  const [result, setResult] = useState<CreditResult | null>(
    existingProject && existingProject.credit_year_1 !== null
      ? {
          year1: existingProject.credit_year_1 ?? 0,
          year2: existingProject.credit_year_2 ?? 0,
          year3: existingProject.credit_year_3 ?? 0,
        }
      : null
  );

  // เก็บ id ของโครงการที่บันทึกแล้ว: ถ้ามีค่า การกดคำนวณครั้งต่อไปจะ "อัปเดต" ไม่ใช่ "สร้างใหม่"
  const [savedProjectId, setSavedProjectId] = useState<string | null>(
    existingProject?.orgtreeproject_id ?? null
  );
  const [saving, setSaving] = useState(false);
  // error ใต้ช่อง: key = projectName / treeId / startDate / tverdetail_id
  const [errors, setErrors] = useState<Record<string, string>>({});
  // ล้างข้อความ error ของช่องที่ระบุ
  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // เก็บค่าที่ผู้ใช้พิมพ์ แล้วล้าง error ของช่องนั้น
  function handleAmountChange(tverdetailId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [tverdetailId]: value }));
    clearError(tverdetailId);
  }

  // schema ของทั้งฟอร์ม (ช่องค่าของ criteria สร้างตามที่แอดมินตั้งไว้)
  function buildSchema(): formSchema<string> {
    const schema: formSchema<string> = {
      projectName: { rules: [required('ชื่อโครงการ'), notNumericOnly('ชื่อโครงการ'), maxLength('ชื่อโครงการ', 150)] },
      treeId: { rules: [requiredSelect('พันธุ์ไม้'), existsIn('พันธุ์ไม้', trees.map((t) => t.tree_id))] },
      startDate: {
        rules: [required('วันที่เริ่มโครงการ'), isDate('วันที่เริ่มโครงการ', { minYear: MIN_START_YEAR, maxYear: MAX_START_YEAR })],
      },
    };
    for (const c of criteria) {
      const label = c.detail_name ?? 'ค่านี้';
      schema[c.tverdetail_id] = {
        normalize: normalizeNumberString,
        rules: [required(label), isDecimal(label, { allowNegative: false })],
      };
    }
    return schema;
  }

  // T ของสูตรเครดิต = ช่อง "จำนวนต้นไม้" (จับคู่ชื่อเงื่อนไขแบบตรงทุกตัวอักษร)
  //   cyn2 ใช้ พื้นที่ × ต้นต่อไร่ แต่เงื่อนไขที่แอดมินตั้งไม่มี "ต้นไม้ต่อไร่" -> ใช้จำนวนต้นที่กรอกตรงๆ (ตรงกับนิยาม T ของสูตร)
  const totalTreesDetail = criteria.find((c) => c.detail_name === TVER_TREE_COUNT_NAME);

  // กดปุ่ม "บันทึกและคำนวณคาร์บอนเครดิต": ตรวจ + คำนวณ (สูตร cyn2) + บันทึก แล้วแสดงกราฟในหน้าเดิม
  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();

    // normalize + validate ทั้งฟอร์มก่อนคำนวณ/บันทึก
    const result = validateForm({ ...amounts, projectName, treeId, startDate }, buildSchema());
    const errs: Record<string, string> = {};
    if (!result.ok) Object.assign(errs, result.errors);

    // เทียบค่าที่กรอกกับเงื่อนไขของแอดมิน (ตรวจข้อมูลอ้างอิงที่เกี่ยวข้อง)
    // อ่านจาก condition_operator / condition_number ตรงๆ ไม่ต้องแกะข้อความแล้ว
    for (const c of criteria) {
      if (errs[c.tverdetail_id] || !c.condition_operator || c.condition_number == null) continue;
      const v = normalizeToArabicNumber(result.clean[c.tverdetail_id]);
      if (v !== null && !meetsCondition(v, c.condition_operator, Number(c.condition_number))) {
        errs[c.tverdetail_id] =
          `ไม่ผ่านเงื่อนไขโครงการ: ต้อง ${formatCondition(c.condition_operator, c.condition_number, c.unit)}`;
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!totalTreesDetail) {
      return showError(`ยังไม่มีเงื่อนไข "${TVER_TREE_COUNT_NAME}" ในหน้าแอดมิน T-VER Project จึงคำนวณคาร์บอนเครดิตไม่ได้`);
    }

    setSaving(true);

    const cleanName = result.clean.projectName; // ชื่อที่ normalize แล้ว
    // [MERGE aom + cyn2] สูตรเครดิตของ cyn2: T × t × 9.5 × 10^-3
    const [year1, year2, year3] = calculateTverCredits(
      normalizeToArabicNumber(result.clean[totalTreesDetail.tverdetail_id]) ?? 0
    );

    const projectValues = {
      project_name: cleanName,
      join_date: startDate || null, // เก็บวันที่เต็ม ใช้ดูสถานะโครงการในหน้า Dashboard
      credit_year_1: year1,
      credit_year_2: year2,
      credit_year_3: year3,
      updated_at: new Date().toISOString(),
    };

    let projectId = savedProjectId;

    if (projectId) {
      // เคยบันทึกแล้ว -> อัปเดตโครงการเดิม ไม่สร้างซ้ำ
      const { error } = await supabase
        .from('org_tree_project')
        .update(projectValues)
        .eq('orgtreeproject_id', projectId);
      if (error) {
        setSaving(false);
        return showError('อัปเดตโครงการไม่สำเร็จ: ' + dbErrorMessage(error));
      }

      // ลบรายละเอียดเดิมก่อน แล้วค่อยบันทึกชุดใหม่ด้านล่าง
      const { error: deleteError } = await supabase
        .from('org_tree_project_detail')
        .delete()
        .eq('orgtreeproject_id', projectId);
      if (deleteError) {
        setSaving(false);
        return showError('อัปเดตรายละเอียดไม่สำเร็จ: ' + dbErrorMessage(deleteError));
      }
    } else {
      // ยังไม่เคยบันทึก -> สร้างโครงการใหม่
      const { data, error } = await supabase
        .from('org_tree_project')
        .insert({ org_id: orgId, ...projectValues })
        .select()
        .single();
      if (error || !data) {
        setSaving(false);
        return showError('บันทึกโครงการไม่สำเร็จ: ' + (error ? dbErrorMessage(error) : 'ไม่ทราบสาเหตุ'));
      }
      projectId = data.orgtreeproject_id as string;
      setSavedProjectId(projectId); // จำไว้ เพื่อให้การกดครั้งต่อไปเป็นการอัปเดต
    }

    // บันทึกรายละเอียดแต่ละ criteria ที่กรอกไว้ (พร้อมพันธุ์ไม้ที่เลือก)
    // ใช้ค่าที่ normalize แล้วจาก result.clean แทน parseFloat(ค่าดิบ)
    const detailRows = criteria
      .filter((c) => result.clean[c.tverdetail_id] !== '')
      .map((c) => ({
        orgtreeproject_id: projectId,
        tverdetail_id: c.tverdetail_id,
        tree_id: result.clean.treeId || null,
        amount: normalizeToArabicNumber(result.clean[c.tverdetail_id]) ?? 0,
        unit: c.unit,
      }));

    if (detailRows.length > 0) {
      const { error: detailError } = await supabase
        .from('org_tree_project_detail')
        .insert(detailRows);
      if (detailError) {
        setSaving(false);
        return showError('บันทึกรายละเอียดโครงการไม่สำเร็จ: ' + dbErrorMessage(detailError));
      }
    }

    // อยู่หน้าเดิม แสดงกราฟเครดิตในการ์ดขวา (ใต้กราฟมีปุ่มไปจัดสรรคาร์บอนเครดิตของ cyn2)
    setResult({ year1, year2, year3 });
    setSaving(false);
    // ไม่เด้ง popup แล้ว: กราฟที่ขึ้นในการ์ดขวาบอกผลอยู่แล้ว
  }

  const maxValue = result ? Math.max(result.year1, result.year2, result.year3) : 0;
  const yAxisMax = Math.ceil(maxValue / 450) * 450 || 1800;

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {/* [ลบ] แถบแจ้งเตือนลอย (มีลิงก์ไปแดชบอร์ด) -> บันทึกเสร็จแสดงกราฟในการ์ดขวาแทน ไม่มี popup */}

      <div className="mb-6">
        {isEditMode && (
          <Link href="/organization/dashboard" className="text-sm text-[#6B7280] hover:underline">
            ‹ กลับหน้าหลัก
          </Link>
        )}
        <h1 className="text-[32px] font-medium text-black">
          {isEditMode ? 'แก้ไขโครงการ T-VER' : 'จำลองโครงการ T-VER'}
        </h1>
        <p className="text-base font-medium text-[#6B7280]">
          การจำลองโครงการปลูกป่าและการจัดสรรคาร์บอนเครดิต
        </p>
      </div>

      <div className="grid grid-cols-[488px_1fr] gap-8 items-start">
        {/* ซ้าย: ฟอร์มตั้งค่าโครงการ */}
        {/* ใส่ noValidate และเอา required ของ browser ออก ให้ใช้ validate ของเราแทน */}
        <form
          onSubmit={handleCalculate}
          noValidate
          className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-8 space-y-5"
        >
          <h2 className="text-xl font-bold text-[#1F2937]">ตั้งค่าโครงการปลูกป่า</h2>

          {/* ชื่อโครงการแบบ combobox: พิมพ์ชื่อใหม่เองได้ หรือเลือกโครงการที่บันทึกไว้จากรายการ (เลือกแล้วเปิดโครงการนั้น)
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
                placeholder={savedProjects.length > 0 ? 'พิมพ์ชื่อโครงการใหม่ หรือเลือกโครงการที่บันทึกไว้' : 'เช่น โครงการปลูกป่าสัก ที่ราบสูงตอนเหนือ'}
                autoComplete="off"
                className={`w-full border rounded-xl px-3 py-3 text-base ${savedProjects.length > 0 ? 'pr-10' : ''} ${errors.projectName ? 'border-red-500' : 'border-[#E5E7EB]'}`}
              />
              {savedProjects.length > 0 && (
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
              {listMode && (shownProjects.length > 0 || isEditMode) && (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                  {shownProjects.map((p) => (
                    <li key={p.orgtreeproject_id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setListMode(null);
                          openSavedProject(p.orgtreeproject_id);
                        }}
                        className="w-full px-3 py-2 text-left text-base hover:bg-[#F3F4F6]"
                      >
                        {p.project_name || '(ไม่มีชื่อ)'}
                      </button>
                    </li>
                  ))}
                  {/* กำลังเปิดโครงการเดิมอยู่ -> มีทางกลับไปเริ่มโครงการใหม่ */}
                  {isEditMode && (
                    <li className="border-t border-[#F3F4F6]">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setListMode(null);
                          openSavedProject('');
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
            {errors.projectName && <p className="text-xs text-red-600">{errors.projectName}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#374151]">พันธุ์ไม้</label>
            <Select
              value={treeId}
              onChange={(v) => {
                setTreeId(v);
                clearError('treeId');
              }}
              className={`w-full border rounded-xl px-3 py-3 text-base ${errors.treeId ? 'border-red-500' : 'border-[#E5E7EB]'}`}
              options={[
                { value: '', label: 'เลือกพันธุ์ไม้', placeholder: true },
                ...trees.map((t) => ({ value: t.tree_id, label: t.tree_name })),
              ]}
            />
            {errors.treeId && <p className="text-xs text-red-600">{errors.treeId}</p>}
          </div>

          {/* ช่องกรอกแบบไดนามิกตามเงื่อนไขที่แอดมินตั้งไว้ */}
          <div className="grid grid-cols-2 gap-4">
            {criteria.map((c) => (
              <div key={c.tverdetail_id} className="space-y-2">
                <label className="block text-sm font-semibold text-[#374151]">
                  {c.detail_name} {c.unit ? `(${c.unit})` : ''}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amounts[c.tverdetail_id] ?? ''}
                  onChange={(e) => handleAmountChange(c.tverdetail_id, e.target.value)}
                  className={`w-full border rounded-xl px-3 py-3 text-base ${
                    errors[c.tverdetail_id] ? 'border-red-500' : 'border-[#E5E7EB]'
                  }`}
                />
                {c.condition_operator && (
                  <p className="text-xs text-[#9CA3AF]">
                    เงื่อนไข: {formatCondition(c.condition_operator, c.condition_number, c.unit)}
                  </p>
                )}
                {errors[c.tverdetail_id] && <p className="text-xs text-red-600">{errors[c.tverdetail_id]}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#374151]">วันที่เริ่มโครงการ</label>
            <input
              type="date"
              min={`${MIN_START_YEAR}-01-01`}
              max={`${MAX_START_YEAR}-12-31`}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                clearError('startDate');
              }}
              className={`w-full border rounded-xl px-3 py-3 text-base ${errors.startDate ? 'border-red-500' : 'border-[#E5E7EB]'}`}
            />
            {errors.startDate && <p className="text-xs text-red-600">{errors.startDate}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary w-[239px] h-[60px] rounded-[20px] text-base font-semibold"
          >
            {/* เดิม "จำลองโครงการปลูกป่า" */}
            {saving ? 'กำลังบันทึก...' : 'บันทึกและคำนวณคาร์บอนเครดิต'}
          </button>
        </form>

        {/* ขวา: ผลลัพธ์ */}
        <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-8">
          <h2 className="text-xl font-bold text-[#1F2937]">การประมาณคาร์บอนเครดิต 3 ปี</h2>
          <p className="text-sm text-[#9CA3AF] mb-8">tCO2e ที่เกิดขึ้นในต่อรอบบัญชี</p>

          {!result && (
            <p className="text-center text-[#9CA3AF] py-20">
              กรอกข้อมูลด้านซ้ายแล้วกด &quot;บันทึกและคำนวณคาร์บอนเครดิต&quot; เพื่อดูผลลัพธ์
            </p>
          )}

          {result && (
            <>
              <div className="flex items-end justify-around gap-6 h-[300px] border-b border-[#E5E7EB] mb-4">
                {[
                  { label: 'ช่วงที่ 1', value: result.year1, color: '#22C55E' },
                  { label: 'ช่วงที่ 2', value: result.year2, color: '#EBAC24' },
                  { label: 'ช่วงที่ 3', value: result.year3, color: '#1DB3EF' },
                ].map((bar) => (
                  <div key={bar.label} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-xs text-[#6B7280]">{bar.value.toFixed(0)}</span>
                    <div
                      className="w-16 rounded-t-[10px]"
                      style={{
                        height: `${(bar.value / yAxisMax) * 260}px`,
                        backgroundColor: bar.color,
                      }}
                    />
                    <span className="text-xs text-[#6B7280]">{bar.label}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'ปีที่ 1', value: result.year1, growth: null as string | null },
                  {
                    label: 'ปีที่ 2',
                    value: result.year2,
                    growth:
                      result.year1 > 0
                        ? ((result.year2 / result.year1 - 1) * 100).toFixed(0)
                        : null,
                  },
                  {
                    label: 'ปีที่ 3',
                    value: result.year3,
                    growth:
                      result.year1 > 0
                        ? ((result.year3 / result.year1 - 1) * 100).toFixed(0)
                        : null,
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl p-6 text-center space-y-1"
                  >
                    <p className="text-xs text-[#6B7280]">{card.label}</p>
                    <p className="text-2xl font-bold text-[#16A34A]">
                      {card.value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">tCO2e</p>
                    {card.growth && (
                      <p className="text-[10px] font-bold text-[#16A34A]">+{card.growth}% เติบโต</p>
                    )}
                  </div>
                ))}
              </div>

              {/* [MERGE aom + cyn2] ต่อไปขั้นที่ 2 ของ cyn2: จัดสรรคาร์บอนเครดิต -> ประเมินภาษี
                  ตกลงกันว่า: จำลองโครงการ (บันทึก / แสดงใน dashboard / แก้ไข) = ของ aom
                               การจัดสรรเครดิตและคำนวณภาษีหลังจากนั้น = ของ cyn2
                  ส่ง id โครงการที่บันทึกแล้วไปทาง ?project= ให้หน้า cyn2 ใช้โครงการนี้
                  แสดงเฉพาะเมื่อบันทึกโครงการแล้ว (มี savedProjectId) */}
              {savedProjectId && (
                <Link
                  href={`/organization/tver_simulation?project=${savedProjectId}`}
                  className="btn btn-primary mt-6 flex h-[52px] w-full items-center justify-center rounded-xl text-base font-semibold"
                >
                  ไปจัดสรรคาร์บอนเครดิต (ขั้นถัดไป) →
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}