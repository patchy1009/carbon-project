'use client';

import { useState } from 'react';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';
import { ModalActions, ModalShell } from '@/components/Modal';
import { deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { validateForm, extendSchema, notDuplicate, requiredWith, type formError } from '@/lib/validation';
import { normalizeToArabicNumber, formatCondition, CONDITION_OPERATORS } from '@/lib/normalization';
import { fieldError as FieldError } from '@/components/FieldError';
import { treeSchema, tverDetailSchema, type TreeField, type TverDetailField } from './schema';

/* [ปรับปรุง] สรุปสิ่งที่เปลี่ยนในไฟล์นี้
 * 1) เดิมบันทึกค่าจากฟอร์มลง DB ตรงๆ -> ตอนนี้ผ่าน normalize + validate (schema.ts) ทุกช่อง
 * 2) เงื่อนไข: เลือกตัวดำเนินการจาก dropdown + กรอกตัวเลขแยกช่อง
 *    บันทึกเป็น condition_operator / condition_number (เลิกใช้คอลัมน์ข้อความ condition_value)
 *    ต้องกรอกคู่กัน หรือเว้นว่างทั้งคู่ = ไม่มีเงื่อนไข
 * 3) ตรวจข้อมูลซ้ำ: ชื่อต้นไม้ห้ามซ้ำ, รายละเอียดโครงการห้ามซ้ำ
 * 4) เปลี่ยนมาใช้ฟังก์ชันกลาง insertRecord / updateRecord / deleteRecord แทนเรียก supabase เอง
 * 5) ใช้ ModalShell / ModalActions จาก components/Modal แทนตัวที่เขียนซ้ำไว้ท้ายไฟล์
 * 6) เพิ่มการแก้ไขทั้ง 2 ตาราง */

const inputCls = (hasError?: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm ${hasError ? 'border-red-500' : ''}`;

const emptyDetailForm = { detail_name: '', unit: '', condition_operator: '', condition_number: '', detail: '' };

export default function TverProjectClient({
  initialTrees,
  initialDetails,
}: {
  initialTrees: TreeListItem[];
  initialDetails: TverProjectDetail[];
}) {
  const [trees, setTrees] = useState<TreeListItem[]>(initialTrees);
  const [details, setDetails] = useState<TverProjectDetail[]>(initialDetails);

  const [showTreeModal, setShowTreeModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // [เพิ่ม] id ของแถวที่กำลังแก้ไข (null = เพิ่มใหม่)
  const [editTreeId, setEditTreeId] = useState<string | null>(null);
  const [editDetailId, setEditDetailId] = useState<string | null>(null);

  const [treeForm, setTreeForm] = useState({ tree_name: '' });
  const [detailForm, setDetailForm] = useState(emptyDetailForm);

  const [treeErrors, setTreeErrors] = useState<formError<TreeField>>({});
  const [detailErrors, setDetailErrors] = useState<formError<TverDetailField>>({});

  function openTreeModal(row?: TreeListItem) {
    setEditTreeId(row?.tree_id ?? null);
    setTreeForm({ tree_name: row?.tree_name ?? '' });
    setTreeErrors({});
    setShowTreeModal(true);
  }
  function openDetailModal(row?: TverProjectDetail) {
    setEditDetailId(row?.tverdetail_id ?? null);
    setDetailForm(
      row
        ? {
            detail_name: row.detail_name ?? '',
            unit: row.unit ?? '',
            condition_operator: row.condition_operator ?? '',
            condition_number: row.condition_number == null ? '' : String(row.condition_number),
            detail: row.detail ?? '',
          }
        : emptyDetailForm
    );
    setDetailErrors({});
    setShowDetailModal(true);
  }
  const closeTreeModal = () => { setShowTreeModal(false); setTreeErrors({}); };
  const closeDetailModal = () => { setShowDetailModal(false); setDetailErrors({}); };

  // ---------- Tree List ----------
  async function handleSaveTree(e: React.FormEvent) {
    e.preventDefault();
    const others = trees.filter((t) => t.tree_id !== editTreeId).map((t) => t.tree_name);
    const result = validateForm(
      treeForm,
      extendSchema(treeSchema, { tree_name: [notDuplicate('ชื่อต้นไม้', others)] })
    );
    if (!result.ok) { setTreeErrors(result.errors); return; }
    setTreeErrors({});

    const values = { tree_name: result.clean.tree_name };
    if (editTreeId) {
      const updated = await updateRecord<TreeListItem>(
        'tree_list', 'tree_id', editTreeId,
        { ...values, updated_at: new Date().toISOString() }, '*', 'แก้ไขต้นไม้'
      );
      if (!updated) return;
      setTrees((prev) => prev.map((t) => (t.tree_id === editTreeId ? updated : t)));
    } else {
      const created = await insertRecord<TreeListItem>('tree_list', values, '*', 'เพิ่มต้นไม้');
      if (!created) return;
      setTrees((prev) => [...prev, created]);
    }
    closeTreeModal();
  }

  async function handleDeleteTree(id: string) {
    const ok = await deleteRecord('tree_list', 'tree_id', id, 'ลบต้นไม้นี้?');
    if (!ok) return;
    setTrees((prev) => prev.filter((t) => t.tree_id !== id));
  }

  // ---------- Project Detail ----------
  async function handleSaveDetail(e: React.FormEvent) {
    e.preventDefault();
    const others = details.filter((d) => d.tverdetail_id !== editDetailId).map((d) => d.detail_name);
    const result = validateForm(
      detailForm,
      extendSchema(tverDetailSchema, {
        detail_name: [notDuplicate('รายละเอียดโครงการ', others)],
        // [เพิ่ม] ตัวดำเนินการกับตัวเลขต้องกรอกคู่กัน (ตรงกับ check constraint ใน DB)
        condition_operator: [requiredWith('เงื่อนไข', detailForm.condition_number)],
        condition_number: [requiredWith('ค่าเงื่อนไข', detailForm.condition_operator)],
      })
    );
    if (!result.ok) { setDetailErrors(result.errors); return; }
    setDetailErrors({});

    // ว่างทั้งคู่ = ไม่มีเงื่อนไข -> เก็บ null ทั้ง 2 คอลัมน์
    const hasCondition = result.clean.condition_operator !== '';
    const values = {
      detail_name: result.clean.detail_name,
      unit: result.clean.unit || null,
      condition_operator: hasCondition ? result.clean.condition_operator : null,
      condition_number: hasCondition ? normalizeToArabicNumber(result.clean.condition_number) : null,
      detail: result.clean.detail || null,
    };

    if (editDetailId) {
      const updated = await updateRecord<TverProjectDetail>(
        'tver_project_detail', 'tverdetail_id', editDetailId,
        { ...values, updated_at: new Date().toISOString() }, '*', 'แก้ไขเงื่อนไข'
      );
      if (!updated) return;
      setDetails((prev) => prev.map((d) => (d.tverdetail_id === editDetailId ? updated : d)));
    } else {
      const created = await insertRecord<TverProjectDetail>('tver_project_detail', values, '*', 'เพิ่มเงื่อนไข');
      if (!created) return;
      setDetails((prev) => [...prev, created]);
    }
    closeDetailModal();
  }

  async function handleDeleteDetail(id: string) {
    const ok = await deleteRecord('tver_project_detail', 'tverdetail_id', id, 'ลบเงื่อนไขนี้?');
    if (!ok) return;
    setDetails((prev) => prev.filter((d) => d.tverdetail_id !== id));
  }

  return (
    <div className="max-w-[1280px] px-8 pt-6 pb-16 space-y-6">
      <h1 className="text-[32px] font-bold leading-10 tracking-[-0.8px] text-[#191C1C] font-['Be_Vietnam_Pro']">
        ข้อมูลการจัดทำโครงการปลูกป่า T-VER
      </h1>

      {/* Section 1: Tree Species Catalog */}
      <section className="rounded-xl bg-white shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#191C1C] font-['Be_Vietnam_Pro']">
            🌳 รายการต้นไม้ (Tree Species Catalog)
          </h2>
          <button
            onClick={() => openTreeModal()}
            className="flex items-center gap-1.5 rounded-lg bg-[#266955] px-3 py-2 text-sm text-white shadow-sm"
          >
            + เพิ่มต้นไม้ใหม่
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EDEEEE]">
              <tr className="text-xs font-bold uppercase tracking-wide text-[#3F4944]">
                <th className="px-4 py-3 text-left">ชื่อต้นไม้</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {trees.map((t) => (
                <tr key={t.tree_id} className="border-b border-[#F3F4F4]">
                  <td className="px-4 py-4 font-bold text-[#191C1C]">{t.tree_name}</td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button
                      onClick={() => openTreeModal(t)}
                      className="text-[#3F4944] hover:text-[#266955]"
                      title="แก้ไข"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteTree(t.tree_id)}
                      className="text-[#3F4944] hover:text-red-500"
                      title="ลบ"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {trees.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-[#6F7974]">
                    ยังไม่มีข้อมูลต้นไม้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Forestry Project Parameters & Criteria */}
      <section className="rounded-xl bg-white shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#191C1C] font-['Be_Vietnam_Pro']">
            📋 รายละเอียดโครงการปลูกป่า (Forestry Project Parameters &amp; Criteria)
          </h2>
          <button
            onClick={() => openDetailModal()}
            className="flex items-center gap-1.5 rounded-lg bg-[#366856] px-3 py-2 text-sm text-white shadow-sm"
          >
            + เพิ่มเงื่อนไขโครงการ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EDEEEE]">
              <tr className="text-xs font-bold uppercase tracking-wide text-[#3F4944]">
                <th className="px-4 py-3 text-left">รายละเอียดโครงการ</th>
                <th className="px-4 py-3 text-left">หน่วย</th>
                <th className="px-4 py-3 text-left">เงื่อนไข</th>
                <th className="px-4 py-3 text-left">คำอธิบาย</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={d.tverdetail_id} className="border-b border-[#F3F4F4]">
                  <td className="px-4 py-4 font-bold text-[#191C1C]">{d.detail_name}</td>
                  <td className="px-4 py-4 text-[#3F4944]">{d.unit}</td>
                  <td className="px-4 py-4">
                    {/* [แก้ไข] สร้างข้อความจาก 2 คอลัมน์ เช่น "<= 1,000 ไร่" */}
                    {d.condition_operator && (
                      <span className="inline-block px-2.5 py-1 rounded bg-[#E7E8E8] text-sm font-bold text-[#266955]">
                        {formatCondition(d.condition_operator, d.condition_number, d.unit)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-[#3F4944] max-w-[420px] whitespace-pre-line">{d.detail}</td>
                  <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => openDetailModal(d)}
                      className="text-[#3F4944] hover:text-[#266955]"
                      title="แก้ไข"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteDetail(d.tverdetail_id)}
                      className="text-[#3F4944] hover:text-red-500"
                      title="ลบ"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {details.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[#6F7974]">
                    ยังไม่มีเงื่อนไขโครงการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- Modal: เพิ่ม/แก้ไขต้นไม้ --- */}
      {showTreeModal && (
        <ModalShell onClose={closeTreeModal}>
          <form onSubmit={handleSaveTree} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editTreeId ? 'แก้ไขต้นไม้' : 'เพิ่มต้นไม้ใหม่'}</h3>
            <div>
              <input
                className={inputCls(!!treeErrors.tree_name)}
                placeholder="ชื่อต้นไม้ เช่น ยางนา"
                maxLength={100}
                value={treeForm.tree_name}
                onChange={(e) => setTreeForm({ tree_name: e.target.value })}
              />
              <FieldError message={treeErrors.tree_name} />
            </div>
            <ModalActions onCancel={closeTreeModal} />
          </form>
        </ModalShell>
      )}

      {/* --- Modal: เพิ่ม/แก้ไขเงื่อนไขโครงการ --- */}
      {showDetailModal && (
        <ModalShell onClose={closeDetailModal}>
          <form onSubmit={handleSaveDetail} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editDetailId ? 'แก้ไขเงื่อนไขโครงการ' : 'เพิ่มเงื่อนไขโครงการ'}</h3>
            <div>
              <input
                className={inputCls(!!detailErrors.detail_name)}
                placeholder="รายละเอียดโครงการ เช่น พื้นที่โครงการทั้งหมด"
                maxLength={150}
                value={detailForm.detail_name}
                onChange={(e) => setDetailForm({ ...detailForm, detail_name: e.target.value })}
              />
              <FieldError message={detailErrors.detail_name} />
            </div>
            <div>
              <input
                className={inputCls(!!detailErrors.unit)}
                placeholder="หน่วย เช่น ไร่, แปลง, ต้น, ปี"
                maxLength={50}
                value={detailForm.unit}
                onChange={(e) => setDetailForm({ ...detailForm, unit: e.target.value })}
              />
              <FieldError message={detailErrors.unit} />
            </div>
            {/* [แก้ไข] เงื่อนไข: dropdown ตัวดำเนินการ + ช่องตัวเลข (เดิมเป็นช่องข้อความช่องเดียว) */}
            <div>
              <label className="mb-1 block text-xs text-[#3F4944]">เงื่อนไข (ไม่บังคับ)</label>
              <div className="flex items-center gap-2">
                {/* แสดงเฉพาะสัญลักษณ์ ตัวอักษรใหญ่ อ่านง่าย (ความหมายแสดงใต้ช่อง) */}
                <select
                  className={`w-24 shrink-0 rounded-lg border px-3 py-2 text-center text-lg font-bold ${
                    detailErrors.condition_operator ? 'border-red-500' : ''
                  }`}
                  value={detailForm.condition_operator}
                  onChange={(e) => setDetailForm({ ...detailForm, condition_operator: e.target.value })}
                  aria-label="เงื่อนไข"
                >
                  <option value="">–</option>
                  {CONDITION_OPERATORS.map((o) => (
                    <option key={o.value} value={o.value} title={o.label}>
                      {o.value}
                    </option>
                  ))}
                </select>
                <input
                  className={`${inputCls(!!detailErrors.condition_number)} flex-1`}
                  placeholder="เช่น 1000"
                  type="text"
                  inputMode="decimal"
                  value={detailForm.condition_number}
                  onChange={(e) => setDetailForm({ ...detailForm, condition_number: e.target.value })}
                />
                {detailForm.unit.trim() && (
                  <span className="self-center whitespace-nowrap text-sm text-[#6F7974]">{detailForm.unit.trim()}</span>
                )}
              </div>
              {/* ความหมายของสัญลักษณ์ที่เลือก */}
              <p className="mt-1 text-xs text-[#6F7974]">
                {detailForm.condition_operator
                  ? `หมายถึง: ${CONDITION_OPERATORS.find((o) => o.value === detailForm.condition_operator)?.label ?? ''}`
                  : 'ไม่มีเงื่อนไข (เว้นว่างทั้ง 2 ช่อง)'}
              </p>
              <FieldError message={detailErrors.condition_operator ?? detailErrors.condition_number} />
            </div>
            <div>
              <textarea
                className={inputCls(!!detailErrors.detail)}
                placeholder="คำอธิบาย"
                rows={3}
                maxLength={1000}
                value={detailForm.detail}
                onChange={(e) => setDetailForm({ ...detailForm, detail: e.target.value })}
              />
              <FieldError message={detailErrors.detail} />
            </div>
            <ModalActions onCancel={closeDetailModal} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}
