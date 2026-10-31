'use client';

import { useState } from 'react';
import type { EfType, EmissionFactor, GwpValue } from '@/types/ef-gwp';
import { ModalActions, ModalShell } from '@/components/Modal';
import { deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { validateForm, extendSchema, notDuplicate, existsIn, type formError } from '@/lib/validation';
import { normalizeToArabicNumber } from '@/lib/normalization';
import { fieldError as FieldError } from '@/components/FieldError';
import { efTypeSchema, efSchema, gwpSchema, type EfTypeField, type EfField, type GwpField } from './schema';
import { PencilIcon, TrashIcon } from '@/components/icons'; // [แก้ไข] แทนอิโมจิ ✏️ 🗑️

/* [ปรับปรุง] สรุปสิ่งที่เปลี่ยนในไฟล์นี้
 * 1) ลบ modal "เพิ่มค่า EF" และ "เพิ่มค่า GWP" ชุดเก่าที่ซ้อนอยู่ (เดิม render 2 ชุดพร้อมกันเวลาเปิด)
 * 2) ประเภท EF: เดิมไม่ได้ validate เลย และปิด modal ผิดตัว (setShowEfModal) -> แก้ให้ validate + ปิดถูกตัว
 * 3) ทุกฟอร์มตรวจ "ข้อมูลซ้ำ" (notDuplicate) และ "ประเภทที่เลือกต้องมีอยู่จริง" (existsIn) ก่อนบันทึก
 * 4) เพิ่มการ "แก้ไข" ทุกตาราง โดยใช้ modal เดียวกับการเพิ่ม (editXxxId = null คือโหมดเพิ่ม)
 * 5) เอา required / type="number" ของ HTML ออก (ใส่ noValidate) ให้ทุกช่องผ่าน normalize + validate ของเรา
 *    เพราะ type="number" รับเลขไทยไม่ได้ และ browser จะเด้งข้อความของมันเองก่อนถึงโค้ดเรา */

const inputCls = (hasError: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm ${hasError ? 'border-red-500' : ''}`;

const palette = [
  { bg: 'bg-[#D3F1FF]', border: 'border-[#84CCFF]', text: 'text-[#1B4FB1]' },
  { bg: 'bg-[#FFE4D9]', border: 'border-[#FFC485]', text: 'text-[#CB6F00]' },
  { bg: 'bg-[#ECFDF5]', border: 'border-[#D1FAE5]', text: 'text-[#047857]' },
];

function colorFor(typeId: string, types: EfType[]) {
  const idx = types.findIndex((t) => t.eftype_id === typeId);
  return palette[idx % palette.length] ?? palette[0];
}

const emptyEfForm = { eftype_id: '', ef_name: '', ef_value: '', real_unit: '' };
const emptyGwpForm = { gas_name: '', gwp_value: '' };

export default function EfGwpClient({
  initialEfTypes,
  initialEf,
  initialGwp,
}: {
  initialEfTypes: EfType[];
  initialEf: EmissionFactor[];
  initialGwp: GwpValue[];
}) {
  const [efTypes, setEfTypes] = useState<EfType[]>(initialEfTypes);
  const [efList, setEfList] = useState<EmissionFactor[]>(initialEf);
  const [gwpList, setGwpList] = useState<GwpValue[]>(initialGwp);

  const [typeErrors, setTypeErrors] = useState<formError<EfTypeField>>({});
  const [efError, setEfError] = useState<formError<EfField>>({});
  const [gwpErrors, setGwpErrors] = useState<formError<GwpField>>({});

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showEfModal, setShowEfModal] = useState(false);
  const [showGwpModal, setShowGwpModal] = useState(false);

  // [เพิ่ม] id ของแถวที่กำลังแก้ไข (null = กำลังเพิ่มใหม่)
  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [editEfId, setEditEfId] = useState<string | null>(null);
  const [editGwpId, setEditGwpId] = useState<string | null>(null);

  const [typeForm, setTypeForm] = useState({ type_name: '' });
  const [efForm, setEfForm] = useState(emptyEfForm);
  const [gwpForm, setGwpForm] = useState(emptyGwpForm);

  function closeTypeModal() { setShowTypeModal(false); setTypeErrors({}); }
  function closeEfModal() { setShowEfModal(false); setEfError({}); }
  function closeGwpModal() { setShowGwpModal(false); setGwpErrors({}); }

  // [เพิ่ม] เปิด modal: ไม่ส่ง row = เพิ่มใหม่ (ฟอร์มว่าง) / ส่ง row = แก้ไข (เติมค่าเดิม)
  function openTypeModal(row?: EfType) {
    setEditTypeId(row?.eftype_id ?? null);
    setTypeForm({ type_name: row?.type_name ?? '' });
    setTypeErrors({});
    setShowTypeModal(true);
  }
  function openEfModal(row?: EmissionFactor) {
    setEditEfId(row?.ef_id ?? null);
    setEfForm(
      row
        ? {
            eftype_id: row.eftype_id ?? '',
            ef_name: row.ef_name ?? '',
            ef_value: row.ef_value == null ? '' : String(row.ef_value),
            real_unit: row.real_unit ?? '',
          }
        : emptyEfForm
    );
    setEfError({});
    setShowEfModal(true);
  }
  function openGwpModal(row?: GwpValue) {
    setEditGwpId(row?.gwp_id ?? null);
    setGwpForm(
      row
        ? { gas_name: row.gas_name ?? '', gwp_value: row.gwp_value == null ? '' : String(row.gwp_value) }
        : emptyGwpForm
    );
    setGwpErrors({});
    setShowGwpModal(true);
  }

  // --- ประเภท EF ---
  async function handleSaveType(e: React.FormEvent) {
    e.preventDefault();
    // [แก้ไข] เดิมบันทึก typeForm.type_name ตรงๆ ไม่ผ่าน normalize/validate
    // ห้ามซ้ำกับประเภทอื่น (ไม่นับแถวที่กำลังแก้ไข)
    const others = efTypes.filter((t) => t.eftype_id !== editTypeId).map((t) => t.type_name);
    const result = validateForm(
      typeForm,
      extendSchema(efTypeSchema, { type_name: [notDuplicate('ประเภท EF', others)] })
    );
    if (!result.ok) { setTypeErrors(result.errors); return; }
    setTypeErrors({});

    const values = { type_name: result.clean.type_name };
    if (editTypeId) {
      const updated = await updateRecord<EfType>(
        'ef_type', 'eftype_id', editTypeId,
        { ...values, updated_date: new Date().toISOString() }, '*', 'แก้ไขประเภท'
      );
      if (!updated) return;
      setEfTypes((prev) => prev.map((t) => (t.eftype_id === editTypeId ? updated : t)));
      // ชื่อประเภทที่ join มากับแถว EF ต้องเปลี่ยนตามด้วย
      setEfList((prev) =>
        prev.map((r) => (r.eftype_id === editTypeId ? { ...r, ef_type: updated } : r))
      );
    } else {
      const created = await insertRecord<EfType>('ef_type', values, '*', 'เพิ่มประเภท');
      if (!created) return;
      setEfTypes((prev) => [...prev, created]);
    }
    closeTypeModal(); // [แก้ไข] เดิมเรียก setShowEfModal(false) ทำให้ modal ประเภทไม่ปิด
  }

  async function handleDeleteType(id: string) {
    const ok = await deleteRecord(
      'ef_type',
      'eftype_id',
      id,
      'ลบประเภทนี้? (emission_factor ที่ผูกอยู่จะ unlink)'
    );
    if (!ok) return;
    setEfTypes((prev) => prev.filter((t) => t.eftype_id !== id));
    setEfList((prev) =>
      prev.map((r) => (r.eftype_id === id ? { ...r, eftype_id: null, ef_type: null } : r))
    );
  }

  // --- ค่า EF ---
  async function handleSaveEf(e: React.FormEvent) {
    e.preventDefault();
    // [เพิ่ม] ห้ามชื่อ EF ซ้ำ "ภายในประเภทเดียวกัน" (ต่างประเภทชื่อเดียวกันได้ เช่น Diesel ของ Stationary / Mobile)
    const sameTypeNames = efList
      .filter((r) => r.ef_id !== editEfId && r.eftype_id === efForm.eftype_id)
      .map((r) => r.ef_name);
    // normalize + validate
    const result = validateForm(
      efForm,
      extendSchema(efSchema, {
        eftype_id: [existsIn('ประเภท EF', efTypes.map((t) => t.eftype_id))], // ตรวจความสัมพันธ์ระหว่างตาราง
        ef_name: [notDuplicate('ชื่อ EF ในประเภทนี้', sameTypeNames)],
      })
    );
    if (!result.ok) {
      setEfError(result.errors); // โชว์ error ใต้ช่อง
      return;
    }
    setEfError({});

    // นำค่า clean มาบันทึกลง func กลาง
    const values = {
      ef_name: result.clean.ef_name,
      ef_value: normalizeToArabicNumber(result.clean.ef_value),
      real_unit: result.clean.real_unit,
      eftype_id: result.clean.eftype_id, // [แก้ไข] ใช้ค่า clean แทน efForm ดิบ
    };
    const select = '*, ef_type(eftype_id, type_name)';

    if (editEfId) {
      const updated = await updateRecord<EmissionFactor>(
        'emission_factor', 'ef_id', editEfId,
        { ...values, updated_date: new Date().toISOString() }, select, 'แก้ไขค่า EF'
      );
      if (!updated) return;
      setEfList((prev) => prev.map((r) => (r.ef_id === editEfId ? updated : r)));
    } else {
      const created = await insertRecord<EmissionFactor>('emission_factor', values, select, 'เพิ่ม EF');
      if (!created) return;
      setEfList((prev) => [...prev, created]);
    }
    closeEfModal();
  }

  async function handleDeleteEf(id: string) {
    const ok = await deleteRecord('emission_factor', 'ef_id', id, 'ลบค่า EF?');
    if (!ok) return;
    setEfList((prev) => prev.filter((r) => r.ef_id !== id));
  }

  // --- ค่า GWP ---
  async function handleSaveGwp(e: React.FormEvent) {
    e.preventDefault();
    const others = gwpList.filter((r) => r.gwp_id !== editGwpId).map((r) => r.gas_name);
    const result = validateForm(
      gwpForm,
      extendSchema(gwpSchema, { gas_name: [notDuplicate('ชื่อก๊าซ', others)] })
    );
    if (!result.ok) { setGwpErrors(result.errors); return; }
    setGwpErrors({});

    const values = {
      gas_name: result.clean.gas_name,
      gwp_value: normalizeToArabicNumber(result.clean.gwp_value),
    };
    if (editGwpId) {
      const updated = await updateRecord<GwpValue>(
        'global_warming_potential', 'gwp_id', editGwpId, values, '*', 'แก้ไขค่า GWP'
      );
      if (!updated) return;
      setGwpList((prev) => prev.map((r) => (r.gwp_id === editGwpId ? updated : r)));
    } else {
      const created = await insertRecord<GwpValue>('global_warming_potential', values, '*', 'เพิ่มค่า GWP');
      if (!created) return;
      setGwpList((prev) => [...prev, created]);
    }
    closeGwpModal();
  }

  async function handleDeleteGwp(id: string) {
    const ok = await deleteRecord('global_warming_potential', 'gwp_id', id, 'ลบค่า GWP นี้?');
    if (!ok) return;
    setGwpList((prev) => prev.filter((r) => r.gwp_id !== id));
  }

  return (
    <div className="max-w-[1280px] px-8 pt-16 pb-8 space-y-8">
      <h1 className="text-[32px] font-bold leading-[32px] tracking-[-0.6px] text-[#0F172A]">
        ค่า Emission Factor (EF) และ ค่า GWP
      </h1>

      {/* Section 1: EF Categories */}
      <div className="w-full rounded-xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <h2 className="text-xl font-bold text-[#0F172A]">
            ประเภท EF (EF Categories)
          </h2>
          <button
            onClick={() => openTypeModal()}
            className="flex items-center gap-1 rounded-lg border border-dashed border-[#6EE7B7] bg-[#266955] px-3 py-1.5 text-xs text-white"
          >
            + เพิ่มประเภท EF ใหม่
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {efTypes.map((t) => (
            <span
              key={t.eftype_id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F1F5F9] text-xs font-sans"
            >
              {/* [เพิ่ม] กดที่ชื่อเพื่อแก้ไข */}
              <button onClick={() => openTypeModal(t)} className="hover:underline" title="แก้ไข" aria-label="แก้ไข">
                {t.type_name}
              </button>
              <button
                onClick={() => handleDeleteType(t.eftype_id)}
                className="text-[#94A3B8] hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Section 2: EF Table */}
      <div className="w-full rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-6 py-6 border-b border-[#F1F5F9]">
          <h2 className="text-xl font-bold text-[#0F172A]">
            ตารางค่า EF (Emission Factor)
          </h2>
          <button
            onClick={() => openEfModal()}
            className="flex items-center gap-1 rounded-lg bg-[#266955] px-3 py-1.5 text-xs text-white shadow-sm"
          >
            + เพิ่มค่า EF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                <th className="px-5 py-3 text-left">ประเภท EF</th>
                <th className="px-5 py-3 text-left">ชื่อแก๊ส</th>
                <th className="px-5 py-3 text-right">ค่า EF</th>
                <th className="px-5 py-3 text-left">หน่วยจริง (UNIT)</th>
                <th className="px-5 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {efList.map((row) => {
                const c = row.eftype_id ? colorFor(row.eftype_id, efTypes) : palette[0];
                return (
                  <tr key={row.ef_id} className="border-t border-[#F1F5F9]">
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${c.bg} ${c.border} ${c.text}`}
                      >
                        {row.ef_type?.type_name ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#0F172A]">{row.ef_name}</td>
                    <td className="px-5 py-4 text-right font-semibold text-[#047857]">
                      {row.ef_value}
                    </td>
                    <td className="px-5 py-4 text-[#64748B]">{row.real_unit}</td>
                    <td className="px-5 py-4 text-center space-x-2">
                      <button onClick={() => openEfModal(row)} className="text-[#94A3B8] hover:text-[#266955]" title="แก้ไข" aria-label="แก้ไข">
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => handleDeleteEf(row.ef_id)}
                        className="text-[#94A3B8] hover:text-red-500"
                        title="ลบ"
                      aria-label="ลบ"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: GWP Table */}
      <div className="w-full max-w-[944px] rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-6 py-6 border-b border-[#F1F5F9]">
          <h2 className="text-xl font-bold text-[#0F172A]">
            ตารางค่า GWP (Global Warming Potential)
          </h2>
          <button
            onClick={() => openGwpModal()}
            className="flex items-center gap-1 rounded-lg bg-[#266955] px-3 py-1.5 text-xs text-white shadow-sm"
          >
            + เพิ่มค่า GWP
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <tr className="text-xs font-bold uppercase text-[#64748B]">
              <th className="px-5 py-3 text-left">ชื่อก๊าซ</th>
              <th className="px-5 py-3 text-right">ค่า GWP</th>
              <th className="px-5 py-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {gwpList.map((row) => (
              <tr key={row.gwp_id} className="border-t border-[#F1F5F9]">
                <td className="px-5 py-4 text-[#0F172A]">{row.gas_name}</td>
                <td className="px-5 py-4 text-right font-semibold text-[#047857]">
                  {row.gwp_value}
                </td>
                <td className="px-5 py-4 text-center space-x-2">
                  <button onClick={() => openGwpModal(row)} className="text-[#94A3B8] hover:text-[#266955]" title="แก้ไข" aria-label="แก้ไข">
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => handleDeleteGwp(row.gwp_id)}
                    className="text-[#94A3B8] hover:text-red-500"
                    title="ลบ"
                  aria-label="ลบ"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Modal: เพิ่ม/แก้ไขประเภท EF --- */}
      {showTypeModal && (
        <ModalShell onClose={closeTypeModal}>
          <form onSubmit={handleSaveType} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editTypeId ? 'แก้ไขประเภท EF' : 'เพิ่มประเภท EF ใหม่'}</h3>
            <div>
              <input
                className={inputCls(!!typeErrors.type_name)}
                placeholder="ชื่อประเภท เช่น Stationary Source"
                type="text"
                maxLength={100}
                value={typeForm.type_name}
                onChange={(e) => setTypeForm({ type_name: e.target.value })}
              />
              <FieldError message={typeErrors.type_name} />
            </div>
            <ModalActions onCancel={closeTypeModal} />
          </form>
        </ModalShell>
      )}

      {/* --- Modal: เพิ่ม/แก้ไขค่า EF --- */}
      {showEfModal && (
        <ModalShell onClose={closeEfModal}>
          <form onSubmit={handleSaveEf} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editEfId ? 'แก้ไขค่า EF' : 'เพิ่มค่า EF ใหม่'}</h3>

            <div>
              <select
                className={inputCls(!!efError.eftype_id)}
                value={efForm.eftype_id}
                onChange={(e) => setEfForm({ ...efForm, eftype_id: e.target.value })}
              >
                <option value="">เลือกประเภท EF</option>
                {efTypes.map((t) => (
                  <option key={t.eftype_id} value={t.eftype_id}>
                    {t.type_name}
                  </option>
                ))}
              </select>
              <FieldError message={efError.eftype_id} />
            </div>

            <div>
              <input
                className={inputCls(!!efError.ef_name)}
                placeholder="ชื่อกิจกรรม/เชื้อเพลิง"
                maxLength={150}
                value={efForm.ef_name}
                onChange={(e) => setEfForm({ ...efForm, ef_name: e.target.value })}
              />
              <FieldError message={efError.ef_name} />
            </div>

            <div>
              <input
                className={inputCls(!!efError.ef_value)}
                placeholder="ค่า EF (ทศนิยมไม่เกิน 6 หลัก)"
                type="text"
                inputMode="decimal"
                value={efForm.ef_value}
                onChange={(e) => setEfForm({ ...efForm, ef_value: e.target.value })}
              />
              <FieldError message={efError.ef_value} />
            </div>

            <div>
              <input
                className={inputCls(!!efError.real_unit)}
                placeholder="หน่วย เช่น kWh, Litre, kg"
                maxLength={50}
                value={efForm.real_unit}
                onChange={(e) => setEfForm({ ...efForm, real_unit: e.target.value })}
              />
              <FieldError message={efError.real_unit} />
            </div>

            <ModalActions onCancel={closeEfModal} />
          </form>
        </ModalShell>
      )}

      {/* --- Modal: เพิ่ม/แก้ไขค่า GWP --- */}
      {showGwpModal && (
        <ModalShell onClose={closeGwpModal}>
          <form onSubmit={handleSaveGwp} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editGwpId ? 'แก้ไขค่า GWP' : 'เพิ่มค่า GWP ใหม่'}</h3>

            <div>
              <input
                className={inputCls(!!gwpErrors.gas_name)}
                placeholder="ชื่อก๊าซ เช่น คาร์บอนไดออกไซด์ (CO2)"
                maxLength={100}
                value={gwpForm.gas_name}
                onChange={(e) => setGwpForm({ ...gwpForm, gas_name: e.target.value })}
              />
              <FieldError message={gwpErrors.gas_name} />
            </div>

            <div>
              <input
                className={inputCls(!!gwpErrors.gwp_value)}
                placeholder="ค่า GWP"
                type="text"
                inputMode="decimal"
                value={gwpForm.gwp_value}
                onChange={(e) => setGwpForm({ ...gwpForm, gwp_value: e.target.value })}
              />
              <FieldError message={gwpErrors.gwp_value} />
            </div>

            <ModalActions onCancel={closeGwpModal} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}
