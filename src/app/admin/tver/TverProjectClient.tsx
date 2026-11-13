// หน้าจัดการโครงการ T-VER ของแอดมิน: เพิ่ม แก้ไข ลบ รายการต้นไม้และเงื่อนไขโครงการ
'use client';

import Select from '@/components/Select'; // dropdown กลาง (แทน <select> ของ browser ให้หน้าตาเหมือนกันทั้งระบบ)
import { useState } from 'react';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';
import { ModalActions, ModalShell } from '@/components/Modal';
import { deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { showSaved } from '@/lib/dialog'; // popup แจ้งบันทึกสำเร็จ
import { validateForm, extendSchema, notDuplicate, requiredWith, type formError } from '@/lib/validation';
import { normalizeToArabicNumber, formatCondition, CONDITION_OPERATORS } from '@/lib/normalization';
import FieldError from '@/components/FieldError';
import { treeSchema, tverDetailSchema, type TreeField, type TverDetailField } from './schema';
import RowActions from '@/components/RowActions'; // ปุ่มแก้ไข/ลบกลาง (เดิมเขียนซ้ำทุกตาราง)
import { T } from '@/components/adminTable'; // การ์ด/ตารางกลางของหน้าแอดมิน (ยกแบบมาจากหน้านี้)
import { inputClass } from '@/components/formStyles'; // class ช่องกรอกกลาง

/* สรุปสิ่งที่เปลี่ยนในไฟล์นี้
 * 1) เดิมบันทึกค่าจากฟอร์มลง DB ตรงๆ -> ตอนนี้ผ่าน normalize + validate (schema.ts) ทุกช่อง
 * 2) เงื่อนไข: เลือกตัวดำเนินการจาก dropdown + กรอกตัวเลขแยกช่อง
 *    บันทึกเป็น condition_operator / condition_number (เลิกใช้คอลัมน์ข้อความ condition_value)
 *    ต้องกรอกคู่กัน หรือเว้นว่างทั้งคู่ = ไม่มีเงื่อนไข
 * 3) ตรวจข้อมูลซ้ำ: ชื่อต้นไม้ห้ามซ้ำ, รายละเอียดโครงการห้ามซ้ำ
 * 4) เปลี่ยนมาใช้ฟังก์ชันกลาง insertRecord / updateRecord / deleteRecord แทนเรียก supabase เอง
 * 5) ใช้ ModalShell / ModalActions จาก components/Modal แทนตัวที่เขียนซ้ำไว้ท้ายไฟล์
 * 6) เพิ่มการแก้ไขทั้ง 2 ตาราง */


const emptyDetailForm = { detail_name: '', unit: '', condition_operator: '', condition_number: '', detail: '' };

// หน้าจอหลัก รับข้อมูลเริ่มต้นจาก page.tsx แล้วเก็บใน state เพื่อให้แก้ไขบนหน้าได้ทันที
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

  // id ของแถวที่กำลังแก้ไข (null = เพิ่มใหม่)
  const [editTreeId, setEditTreeId] = useState<string | null>(null);
  const [editDetailId, setEditDetailId] = useState<string | null>(null);

  const [treeForm, setTreeForm] = useState({ tree_name: '' });
  const [detailForm, setDetailForm] = useState(emptyDetailForm);

  const [treeErrors, setTreeErrors] = useState<formError<TreeField>>({});
  const [detailErrors, setDetailErrors] = useState<formError<TverDetailField>>({});

  // เปิดฟอร์มต้นไม้ ถ้าส่ง row มาคือโหมดแก้ไข ถ้าไม่ส่งคือเพิ่มใหม่
  function openTreeModal(row?: TreeListItem) {
    setEditTreeId(row?.tree_id ?? null);
    setTreeForm({ tree_name: row?.tree_name ?? '' });
    setTreeErrors({});
    setShowTreeModal(true);
  }
  // เปิดฟอร์มเงื่อนไข ถ้าส่ง row มาคือโหมดแก้ไข ถ้าไม่ส่งคือเพิ่มใหม่
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
  // ปิดฟอร์มต้นไม้และล้างข้อความ error
  const closeTreeModal = () => { setShowTreeModal(false); setTreeErrors({}); };
  // ปิดฟอร์มเงื่อนไขและล้างข้อความ error
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
    showSaved(); // popup แจ้งบันทึกสำเร็จ (เหมือนฝั่งองค์กร)
  }

  // ลบต้นไม้ สำเร็จแล้วเอาออกจากรายการบนหน้า
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
        // ตัวดำเนินการกับตัวเลขต้องกรอกคู่กัน (ตรงกับ check constraint ใน DB)
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
    showSaved();
  }

  // ลบเงื่อนไข สำเร็จแล้วเอาออกจากรายการบนหน้า
  async function handleDeleteDetail(id: string) {
    const ok = await deleteRecord('tver_project_detail', 'tverdetail_id', id, 'ลบเงื่อนไขนี้?');
    if (!ok) return;
    setDetails((prev) => prev.filter((d) => d.tverdetail_id !== id));
  }

  return (
    <div className={T.page}>
      <h1 className={T.h1}>
        ข้อมูลการจัดทำโครงการปลูกป่า T-VER
      </h1>

      {/* Section 1: Tree Species Catalog */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>
            รายการต้นไม้ (Tree Species Catalog)
          </h2>
          <button
            onClick={() => openTreeModal()}
            className={T.addBtn}
          >
            + เพิ่มต้นไม้ใหม่
          </button>
        </div>

        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr className={T.headRow}>
                <th className={`${T.th} text-left`}>ชื่อต้นไม้</th>
                <th className={`${T.th} text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {trees.map((t) => (
                <tr key={t.tree_id} className={T.row}>
                  <td className={T.tdMain}>{t.tree_name}</td>
                  <td className={T.tdActions}>
                    <RowActions onEdit={() => openTreeModal(t)} onDelete={() => handleDeleteTree(t.tree_id)} />
                  </td>
                </tr>
              ))}
              {trees.length === 0 && (
                <tr>
                  <td colSpan={2} className={T.empty}>
                    ยังไม่มีข้อมูลต้นไม้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Forestry Project Parameters & Criteria */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>
            รายละเอียดโครงการปลูกป่า (Forestry Project Parameters &amp; Criteria)
          </h2>
          <button
            onClick={() => openDetailModal()}
            className={T.addBtn}
          >
            + เพิ่มเงื่อนไขโครงการ
          </button>
        </div>

        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr className={T.headRow}>
                <th className={`${T.th} text-left`}>รายละเอียดโครงการ</th>
                <th className={`${T.th} text-left`}>หน่วย</th>
                <th className={`${T.th} text-left`}>เงื่อนไข</th>
                <th className={`${T.th} text-left`}>คำอธิบาย</th>
                <th className={`${T.th} text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={d.tverdetail_id} className={T.row}>
                  <td className={T.tdMain}>{d.detail_name}</td>
                  <td className={T.td}>{d.unit}</td>
                  <td className={T.td}>
                    {/* สร้างข้อความจาก 2 คอลัมน์ เช่น "<= 1,000 ไร่" */}
                    {d.condition_operator && (
                      <span className="inline-block px-2.5 py-1 rounded bg-[#E7E8E8] text-sm font-bold text-[#266955]">
                        {formatCondition(d.condition_operator, d.condition_number, d.unit)}
                      </span>
                    )}
                  </td>
                  <td className={`${T.td} max-w-[420px] whitespace-pre-line`}>{d.detail}</td>
                  <td className={T.tdActions}>
                    <RowActions onEdit={() => openDetailModal(d)} onDelete={() => handleDeleteDetail(d.tverdetail_id)} />
                  </td>
                </tr>
              ))}
              {details.length === 0 && (
                <tr>
                  <td colSpan={5} className={T.empty}>
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
                className={inputClass(!!treeErrors.tree_name)}
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
                className={inputClass(!!detailErrors.detail_name)}
                placeholder="รายละเอียดโครงการ เช่น พื้นที่โครงการทั้งหมด"
                maxLength={150}
                value={detailForm.detail_name}
                onChange={(e) => setDetailForm({ ...detailForm, detail_name: e.target.value })}
              />
              <FieldError message={detailErrors.detail_name} />
            </div>
            <div>
              <input
                className={inputClass(!!detailErrors.unit)}
                placeholder="หน่วย เช่น ไร่, แปลง, ต้น, ปี"
                maxLength={50}
                value={detailForm.unit}
                onChange={(e) => setDetailForm({ ...detailForm, unit: e.target.value })}
              />
              <FieldError message={detailErrors.unit} />
            </div>
            {/* เงื่อนไข: dropdown ตัวดำเนินการ + ช่องตัวเลข (เดิมเป็นช่องข้อความช่องเดียว) */}
            <div>
              <label className="mb-1 block text-xs text-[#3F4944]">เงื่อนไข (ไม่บังคับ)</label>
              <div className="flex items-center gap-2">
                {/* แสดงเฉพาะสัญลักษณ์ ตัวอักษรใหญ่ อ่านง่าย (ความหมายแสดงใต้ช่อง) */}
                <Select
                  className={`w-24 shrink-0 rounded-lg border px-3 py-2 text-center text-lg font-bold ${
                    detailErrors.condition_operator ? 'border-red-500' : ''
                  }`}
                  value={detailForm.condition_operator}
                  onChange={(v) => setDetailForm({ ...detailForm, condition_operator: v })}
                  options={[
                    { value: '', label: '–', placeholder: true },
                    // ในรายการแสดงทั้งเครื่องหมายและคำอธิบาย (เดิมคำอธิบายอยู่ใน title)
                    ...CONDITION_OPERATORS.map((o) => ({ value: o.value, label: `${o.value}  ${o.label}` })),
                  ]}
                />
                <input
                  className={`${inputClass(!!detailErrors.condition_number)} flex-1`}
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
                className={inputClass(!!detailErrors.detail)}
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
