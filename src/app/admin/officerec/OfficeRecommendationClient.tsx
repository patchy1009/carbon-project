'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  OfficeInfoType,
  CarbonReductionRecommendation,
} from '@/types/office-recommendations';

export default function OfficeRecommendationClient({
  initialInfo,
  initialRecs,
}: {
  initialInfo: OfficeInfoType[];
  initialRecs: CarbonReductionRecommendation[];
}) {
  const [infoList, setInfoList] = useState<OfficeInfoType[]>(initialInfo);
  const [recs, setRecs] = useState<CarbonReductionRecommendation[]>(initialRecs);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);

  const [infoForm, setInfoForm] = useState({ info_name: '', info_detail: '', unit: '' });
  const [recForm, setRecForm] = useState({ recommendation: '', carbon_reduction_amount: '' });

  // ---------- Office Info ----------
  async function handleAddInfo(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('office_info_type')
      .insert({
        info_name: infoForm.info_name,
        info_detail: infoForm.info_detail,
        unit: infoForm.unit,
      })
      .select()
      .single();
    if (error) return alert('เพิ่มข้อมูลสำนักงานไม่สำเร็จ: ' + error.message);
    setInfoList((prev) => [...prev, data as OfficeInfoType]);
    setShowInfoModal(false);
    setInfoForm({ info_name: '', info_detail: '', unit: '' });
  }

  async function handleDeleteInfo(id: string) {
    if (!confirm('ลบข้อมูลนี้?')) return;
    const { error } = await supabase.from('office_info_type').delete().eq('info_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setInfoList((prev) => prev.filter((i) => i.info_id !== id));
  }

  // ---------- Recommendation ----------
  async function handleAddRec(e: React.FormEvent) {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('carbon_reduction_recommendation')
      .insert({
        recommendation: recForm.recommendation,
        carbon_reduction_amount: Number(recForm.carbon_reduction_amount),
        admin_id: user?.id, // admin_id เป็น NOT NULL ในตารางนี้ ต้องส่งเสมอ
      })
      .select()
      .single();
    if (error) return alert('เพิ่มแนวทางลดคาร์บอนไม่สำเร็จ: ' + error.message);
    setRecs((prev) => [...prev, data as CarbonReductionRecommendation]);
    setShowRecModal(false);
    setRecForm({ recommendation: '', carbon_reduction_amount: '' });
  }

  async function handleDeleteRec(id: string) {
    if (!confirm('ลบแนวทางนี้?')) return;
    const { error } = await supabase
      .from('carbon_reduction_recommendation')
      .delete()
      .eq('rec_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setRecs((prev) => prev.filter((r) => r.rec_id !== id));
  }

  return (
    <div className="max-w-[1280px] px-8 pt-6 pb-16 space-y-8">
      <h1 className="text-[32px] font-bold leading-10 tracking-[-0.8px] text-[#191C1C] font-['Be_Vietnam_Pro']">
        ข้อมูลสำนักงาน &amp; แนวทางลดคาร์บอน
      </h1>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Section A: Office Info */}
        <section className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between bg-[#F3F4F4] px-6 py-6">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-[#B8EED8] flex items-center justify-center text-lg">
                🏢
              </span>
              <h2 className="text-xl font-bold text-[#191C1C] font-['Be_Vietnam_Pro']">
                ข้อมูลสำนักงาน
              </h2>
            </div>
            <button
              onClick={() => setShowInfoModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#266955] px-3 py-2 text-sm text-white shadow-sm whitespace-nowrap"
            >
              + เพิ่มข้อมูลสำนักงานใหม่
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#E7E8E8]">
                <tr className="text-sm font-bold text-[#3F4944]">
                  <th className="px-6 py-3 text-left">ชื่อฟิลด์พารามิเตอร์</th>
                  <th className="px-3 py-3 text-center">หน่วย</th>
                  <th className="px-6 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {infoList.map((info) => (
                  <tr key={info.info_id} className="border-b border-[#F3F4F4]">
                    <td className="px-6 py-4">
                      <p className="font-bold text-[#191C1C]">{info.info_name}</p>
                      <p className="text-xs font-bold text-[#3F4944]">{info.info_detail}</p>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="inline-block px-3 py-1.5 rounded bg-[#E7E8E8] text-xs text-[#3F4944]">
                        {info.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteInfo(info.info_id)}
                        className="text-[#3F4944] hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {infoList.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-[#6F7974]">
                      ยังไม่มีข้อมูลสำนักงาน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section B: Carbon Reduction Recommendations */}
        <section className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between bg-[#F3F4F4] px-6 py-6">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-[#B8EED8] flex items-center justify-center text-lg">
                🌿
              </span>
              <h2 className="text-xl font-bold text-[#191C1C] font-['Be_Vietnam_Pro']">
                แนวทางลดคาร์บอน
              </h2>
            </div>
            <button
              onClick={() => setShowRecModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#266955] px-3 py-2 text-sm text-white shadow-sm whitespace-nowrap"
            >
              + เพิ่มแนวทางลดคาร์บอน
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#E7E8E8]">
                <tr className="text-sm font-bold text-[#3F4944]">
                  <th className="px-6 py-3 text-left">ชื่อข้อเสนอแนะ</th>
                  <th className="px-3 py-3 text-right">ประมาณคาร์บอนที่คาดว่าจะลดได้</th>
                  <th className="px-6 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.rec_id} className="border-b border-[#F3F4F4]">
                    <td className="px-6 py-4 text-[#191C1C]">{r.recommendation}</td>
                    <td className="px-3 py-4 text-right">
                      <span className="inline-block px-2.5 py-1.5 rounded bg-[#B8EED8] text-xs text-[#3C6E5C]">
                        ลดได้ {r.carbon_reduction_amount} kgCO2e
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteRec(r.rec_id)}
                        className="text-[#3F4944] hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {recs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-[#6F7974]">
                      ยังไม่มีแนวทางลดคาร์บอน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* --- Modal: เพิ่มข้อมูลสำนักงาน --- */}
      {showInfoModal && (
        <ModalShell onClose={() => setShowInfoModal(false)}>
          <form onSubmit={handleAddInfo} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มข้อมูลสำนักงานใหม่</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อฟิลด์พารามิเตอร์ เช่น พื้นที่ใช้งานรวม"
              value={infoForm.info_name}
              onChange={(e) => setInfoForm({ ...infoForm, info_name: e.target.value })}
              required
            />
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="คำอธิบาย เช่น พื้นที่ใช้สอยภายในอาคารทุกชั้น"
              rows={2}
              value={infoForm.info_detail}
              onChange={(e) => setInfoForm({ ...infoForm, info_detail: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="หน่วย เช่น ตารางเมตร, คน, ชั่วโมง"
              value={infoForm.unit}
              onChange={(e) => setInfoForm({ ...infoForm, unit: e.target.value })}
            />
            <ModalActions onCancel={() => setShowInfoModal(false)} />
          </form>
        </ModalShell>
      )}

      {/* --- Modal: เพิ่มแนวทางลดคาร์บอน --- */}
      {showRecModal && (
        <ModalShell onClose={() => setShowRecModal(false)}>
          <form onSubmit={handleAddRec} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มแนวทางลดคาร์บอน</h3>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อข้อเสนอแนะ เช่น เปลี่ยนมาใช้หลอดไฟ LED"
              rows={2}
              value={recForm.recommendation}
              onChange={(e) => setRecForm({ ...recForm, recommendation: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ปริมาณคาร์บอนที่คาดว่าจะลดได้ (kgCO2e)"
              type="number"
              step="any"
              value={recForm.carbon_reduction_amount}
              onChange={(e) =>
                setRecForm({ ...recForm, carbon_reduction_amount: e.target.value })
              }
              required
            />
            <ModalActions onCancel={() => setShowRecModal(false)} />
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