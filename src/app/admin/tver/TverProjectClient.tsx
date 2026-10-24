'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';

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

  const [treeForm, setTreeForm] = useState({ tree_name: '' });
  const [detailForm, setDetailForm] = useState({
    detail_name: '',
    unit: '',
    condition_value: '',
    detail: '',
  });

  // ---------- Tree List ----------
  async function handleAddTree(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('tree_list')
      .insert({ tree_name: treeForm.tree_name })
      .select()
      .single();
    if (error) return alert('เพิ่มต้นไม้ไม่สำเร็จ: ' + error.message);
    setTrees((prev) => [...prev, data as TreeListItem]);
    setShowTreeModal(false);
    setTreeForm({ tree_name: '' });
  }

  async function handleDeleteTree(id: string) {
    if (!confirm('ลบต้นไม้นี้?')) return;
    const { error } = await supabase.from('tree_list').delete().eq('tree_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setTrees((prev) => prev.filter((t) => t.tree_id !== id));
  }

  // ---------- Project Detail ----------
  async function handleAddDetail(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('tver_project_detail')
      .insert({
        detail_name: detailForm.detail_name,
        unit: detailForm.unit,
        condition_value: detailForm.condition_value || null,
        detail: detailForm.detail || null,
      })
      .select()
      .single();
    if (error) return alert('เพิ่มเงื่อนไขไม่สำเร็จ: ' + error.message);
    setDetails((prev) => [...prev, data as TverProjectDetail]);
    setShowDetailModal(false);
    setDetailForm({ detail_name: '', unit: '', condition_value: '', detail: '' });
  }

  async function handleDeleteDetail(id: string) {
    if (!confirm('ลบเงื่อนไขนี้?')) return;
    const { error } = await supabase
      .from('tver_project_detail')
      .delete()
      .eq('tverdetail_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
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
            onClick={() => setShowTreeModal(true)}
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
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => handleDeleteTree(t.tree_id)}
                      className="text-[#3F4944] hover:text-red-500"
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
            onClick={() => setShowDetailModal(true)}
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
                    {d.condition_value && (
                      <span className="inline-block px-2.5 py-1 rounded bg-[#E7E8E8] text-sm font-bold text-[#266955]">
                        {d.condition_value}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-[#3F4944] max-w-[420px]">{d.detail}</td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => handleDeleteDetail(d.tverdetail_id)}
                      className="text-[#3F4944] hover:text-red-500"
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

      {/* --- Modal: เพิ่มต้นไม้ใหม่ --- */}
      {showTreeModal && (
        <ModalShell onClose={() => setShowTreeModal(false)}>
          <form onSubmit={handleAddTree} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มต้นไม้ใหม่</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อต้นไม้ เช่น ยางนา"
              value={treeForm.tree_name}
              onChange={(e) => setTreeForm({ tree_name: e.target.value })}
              required
            />
            <ModalActions onCancel={() => setShowTreeModal(false)} />
          </form>
        </ModalShell>
      )}

      {/* --- Modal: เพิ่มเงื่อนไขโครงการ --- */}
      {showDetailModal && (
        <ModalShell onClose={() => setShowDetailModal(false)}>
          <form onSubmit={handleAddDetail} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มเงื่อนไขโครงการ</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="รายละเอียดโครงการ เช่น พื้นที่โครงการทั้งหมด"
              value={detailForm.detail_name}
              onChange={(e) => setDetailForm({ ...detailForm, detail_name: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="หน่วย เช่น ไร่, แปลง, ต้น, ปี"
              value={detailForm.unit}
              onChange={(e) => setDetailForm({ ...detailForm, unit: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="เงื่อนไข เช่น <= 1000, >= 10 ปี"
              value={detailForm.condition_value}
              onChange={(e) => setDetailForm({ ...detailForm, condition_value: e.target.value })}
            />
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="คำอธิบาย"
              rows={3}
              value={detailForm.detail}
              onChange={(e) => setDetailForm({ ...detailForm, detail: e.target.value })}
            />
            <ModalActions onCancel={() => setShowDetailModal(false)} />
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
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-[440px]"
        onClick={(e) => e.stopPropagation()}
      >
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