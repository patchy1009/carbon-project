'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { EfType, EmissionFactor, GwpValue } from '@/types/ef-gwp';

const palette = [
  { bg: 'bg-[#D3F1FF]', border: 'border-[#84CCFF]', text: 'text-[#1B4FB1]' },
  { bg: 'bg-[#FFE4D9]', border: 'border-[#FFC485]', text: 'text-[#CB6F00]' },
  { bg: 'bg-[#ECFDF5]', border: 'border-[#D1FAE5]', text: 'text-[#047857]' },
];

function colorFor(typeId: string, types: EfType[]) {
  const idx = types.findIndex((t) => t.eftype_id === typeId);
  return palette[idx % palette.length] ?? palette[0];
}

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

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showEfModal, setShowEfModal] = useState(false);
  const [showGwpModal, setShowGwpModal] = useState(false);

  const [typeForm, setTypeForm] = useState({ type_name: '' });
  const [efForm, setEfForm] = useState({
    eftype_id: '',
    ef_name: '',
    ef_value: '',
    real_unit: '',
  });
  const [gwpForm, setGwpForm] = useState({ gas_name: '', gwp_value: '' });

  // --- ประเภท EF ---
  async function handleAddType(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('ef_type')
      .insert({ type_name: typeForm.type_name })
      .select()
      .single();
    if (error) return alert('เพิ่มประเภทไม่สำเร็จ: ' + error.message);
    setEfTypes((prev) => [...prev, data as EfType]);
    setShowTypeModal(false);
    setTypeForm({ type_name: '' });
  }

  async function handleDeleteType(id: string) {
    if (!confirm('ลบประเภทนี้? (emission_factor ที่ผูกอยู่จะถูก unlink)')) return;
    const { error } = await supabase.from('ef_type').delete().eq('eftype_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setEfTypes((prev) => prev.filter((t) => t.eftype_id !== id));
  }

  // --- ค่า EF ---
  async function handleAddEf(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('emission_factor')
      .insert({
        eftype_id: efForm.eftype_id || null,
        ef_name: efForm.ef_name,
        ef_value: Number(efForm.ef_value),
        real_unit: efForm.real_unit,
      })
      .select('*, ef_type(eftype_id, type_name)')
      .single();
    if (error) return alert('เพิ่มค่า EF ไม่สำเร็จ: ' + error.message);
    setEfList((prev) => [...prev, data as EmissionFactor]);
    setShowEfModal(false);
    setEfForm({ eftype_id: '', ef_name: '', ef_value: '', real_unit: '' });
  }

  async function handleDeleteEf(id: string) {
    if (!confirm('ลบค่า EF นี้?')) return;
    const { error } = await supabase.from('emission_factor').delete().eq('ef_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setEfList((prev) => prev.filter((r) => r.ef_id !== id));
  }

  // --- ค่า GWP ---
  async function handleAddGwp(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('global_warming_potential')
      .insert({
        gas_name: gwpForm.gas_name,
        gwp_value: Number(gwpForm.gwp_value),
      })
      .select()
      .single();
    if (error) return alert('เพิ่มค่า GWP ไม่สำเร็จ: ' + error.message);
    setGwpList((prev) => [...prev, data as GwpValue]);
    setShowGwpModal(false);
    setGwpForm({ gas_name: '', gwp_value: '' });
  }

  async function handleDeleteGwp(id: string) {
    if (!confirm('ลบค่า GWP นี้?')) return;
    const { error } = await supabase
      .from('global_warming_potential')
      .delete()
      .eq('gwp_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setGwpList((prev) => prev.filter((r) => r.gwp_id !== id));
  }

  return (
    <div className="max-w-[1280px] px-8 pt-16 pb-8 space-y-8">
      <h1 className="text-[32px] font-bold leading-[32px] tracking-[-0.6px] text-[#0F172A] font-['Be_Vietnam_Pro']">
        ค่า Emission Factor (EF) และ ค่า GWP
      </h1>

      {/* Section 1: EF Categories */}
      <div className="w-full rounded-xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <h2 className="text-xl font-bold text-[#0F172A] font-['Be_Vietnam_Pro']">
            ประเภท EF (EF Categories)
          </h2>
          <button
            onClick={() => setShowTypeModal(true)}
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
              {t.type_name}
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
          <h2 className="text-xl font-bold text-[#0F172A] font-['Be_Vietnam_Pro']">
            ตารางค่า EF (Emission Factor)
          </h2>
          <button
            onClick={() => setShowEfModal(true)}
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
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleDeleteEf(row.ef_id)}
                        className="text-[#94A3B8] hover:text-red-500"
                      >
                        🗑️
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
          <h2 className="text-xl font-bold text-[#0F172A] font-['Be_Vietnam_Pro']">
            ตารางค่า GWP (Global Warming Potential)
          </h2>
          <button
            onClick={() => setShowGwpModal(true)}
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
                <td className="px-5 py-4 text-center">
                  <button
                    onClick={() => handleDeleteGwp(row.gwp_id)}
                    className="text-[#94A3B8] hover:text-red-500"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Modal: เพิ่มประเภท EF --- */}
      {showTypeModal && (
        <ModalShell onClose={() => setShowTypeModal(false)}>
          <form onSubmit={handleAddType} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มประเภท EF ใหม่</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อประเภท เช่น Stationary Source"
              value={typeForm.type_name}
              onChange={(e) => setTypeForm({ type_name: e.target.value })}
              required
            />
            <ModalActions onCancel={() => setShowTypeModal(false)} />
          </form>
        </ModalShell>
      )}

      {/* --- Modal: เพิ่มค่า EF --- */}
      {showEfModal && (
        <ModalShell onClose={() => setShowEfModal(false)}>
          <form onSubmit={handleAddEf} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มค่า EF ใหม่</h3>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={efForm.eftype_id}
              onChange={(e) => setEfForm({ ...efForm, eftype_id: e.target.value })}
              required
            >
              <option value="">เลือกประเภท EF</option>
              {efTypes.map((t) => (
                <option key={t.eftype_id} value={t.eftype_id}>
                  {t.type_name}
                </option>
              ))}
            </select>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อกิจกรรม/เชื้อเพลิง"
              value={efForm.ef_name}
              onChange={(e) => setEfForm({ ...efForm, ef_name: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ค่า EF"
              type="number"
              step="any"
              value={efForm.ef_value}
              onChange={(e) => setEfForm({ ...efForm, ef_value: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="หน่วย เช่น kWh, Litre, kg"
              value={efForm.real_unit}
              onChange={(e) => setEfForm({ ...efForm, real_unit: e.target.value })}
              required
            />
            <ModalActions onCancel={() => setShowEfModal(false)} />
          </form>
        </ModalShell>
      )}

      {/* --- Modal: เพิ่มค่า GWP --- */}
      {showGwpModal && (
        <ModalShell onClose={() => setShowGwpModal(false)}>
          <form onSubmit={handleAddGwp} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มค่า GWP ใหม่</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อก๊าซ เช่น คาร์บอนไดออกไซด์ (CO2)"
              value={gwpForm.gas_name}
              onChange={(e) => setGwpForm({ ...gwpForm, gas_name: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ค่า GWP"
              type="number"
              step="any"
              value={gwpForm.gwp_value}
              onChange={(e) => setGwpForm({ ...gwpForm, gwp_value: e.target.value })}
              required
            />
            <ModalActions onCancel={() => setShowGwpModal(false)} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="bg-white rounded-xl p-6 w-[420px]" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border">
        ยกเลิก
      </button>
      <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-[#059669] text-white">
        บันทึก
      </button>
    </div>
  );
}
