'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';
import type { ScopeGroup } from '@/types/footprint';

export default function FootprintClient({
  scopeGroups,
  orgId,
  existingLogId = null, // มีค่า = โหมดแก้ไขรายการเดิม
  existingValues = {},  // ค่าที่เคยกรอก key = scopedetail_id
}: {
  scopeGroups: ScopeGroup[];
  orgId: string;
  existingLogId?: string | null;
  existingValues?: Record<string, string>;
}) {
  const isEdit = existingLogId !== null;

  const [values, setValues] = useState<Record<string, string>>(existingValues);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);

  function handleChange(scopedetailId: string, value: string) {
    setValues((prev) => ({ ...prev, [scopedetailId]: value }));
  }

  async function handleCalculate() {
    setLoading(true);

    // เก็บเฉพาะรายการที่กรอก (> 0) พร้อมคำนวณก๊าซของแต่ละรายการ
    const rows: {
      scopedetail_id: string;
      amount: number;
      unit: string | null;
      ghg_emission: number; // tCO2e
    }[] = [];

    for (const group of scopeGroups) {
      for (const detail of group.details) {
        const qty = parseFloat(values[detail.scopedetail_id] ?? '0') || 0;
        if (qty <= 0) continue;
        const ef = detail.emission_factor?.ef_value ?? 0;
        const gwp = detail.global_warming_potential?.gwp_value ?? 1;
        rows.push({
          scopedetail_id: detail.scopedetail_id,
          amount: qty,
          unit: detail.unit ?? null,
          ghg_emission: (qty * ef * gwp) / 1000, // kgCO2e -> tCO2e
        });
      }
    }

    if (rows.length === 0) {
      setLoading(false);
      alert('กรุณากรอกปริมาณอย่างน้อย 1 รายการ');
      return;
    }

    const total = rows.reduce((sum, r) => sum + r.ghg_emission, 0);

    // ================= โหมดแก้ไข =================
    if (isEdit && existingLogId) {
      // 1) จำ id รายละเอียดเดิมไว้ก่อน (ยังไม่ลบ)
      const { data: oldRows, error: oldError } = await supabase
        .from('org_activity_detail')
        .select('orgactdetail_id')
        .eq('orgactlist_id', existingLogId);
      if (oldError) {
        setLoading(false);
        alert('อ่านรายละเอียดเดิมไม่สำเร็จ: ' + oldError.message);
        return;
      }

      // 2) เพิ่มรายละเอียดชุดใหม่ก่อน ถ้าล้มเหลวข้อมูลเดิมยังอยู่ครบ
      const { error: insError } = await supabase
        .from('org_activity_detail')
        .insert(rows.map((r) => ({ orgactlist_id: existingLogId, ...r })));
      if (insError) {
        setLoading(false);
        alert('บันทึกรายละเอียดไม่สำเร็จ: ' + insError.message);
        return;
      }

      // 3) ลบรายละเอียดชุดเดิม
      const oldIds = (oldRows ?? []).map((r: any) => r.orgactdetail_id as string);
      if (oldIds.length > 0) {
        const { error: delError } = await supabase
          .from('org_activity_detail')
          .delete()
          .in('orgactdetail_id', oldIds);
        if (delError) {
          setLoading(false);
          alert('ลบรายละเอียดเดิมไม่สำเร็จ: ' + delError.message);
          return;
        }
      }

      // 4) อัปเดตยอดรวมของหัวรายการ
      const { error: updError } = await supabase
        .from('org_activity_list')
        .update({
          total_ghg_emission: total,
          updated_at: new Date().toISOString(),
        })
        .eq('orgactlist_id', existingLogId)
        .eq('org_id', orgId);

      setLoading(false);
      if (updError) {
        alert('อัปเดตยอดรวมไม่สำเร็จ: ' + updError.message);
        return;
      }

      setDone({ id: existingLogId, total });
      return;
    }

    // ================= โหมดสร้างใหม่ =================
    // 1) บันทึกหัวรายการ (ยอดรวม) ลง org_activity_list
    const { data: head, error: headError } = await supabase
      .from('org_activity_list')
      .insert({
        org_id: orgId,
        orgact_name: `บันทึกการปล่อยก๊าซ — ${new Date().toLocaleDateString('th-TH')}`,
        total_ghg_emission: total,
        unit: 'tCO2e',
      })
      .select('orgactlist_id')
      .single();

    if (headError || !head) {
      setLoading(false);
      alert('บันทึกไม่สำเร็จ: ' + headError?.message);
      return;
    }

    // 2) บันทึกรายละเอียดแต่ละรายการ ลง org_activity_detail
    const { error: detailError } = await supabase.from('org_activity_detail').insert(
      rows.map((r) => ({ orgactlist_id: head.orgactlist_id, ...r }))
    );

    if (detailError) {
      // ลบหัวรายการที่เพิ่งสร้าง ไม่ให้เหลือรายการที่ไม่มีรายละเอียด
      await supabase.from('org_activity_list').delete().eq('orgactlist_id', head.orgactlist_id);
      setLoading(false);
      alert('บันทึกรายละเอียดไม่สำเร็จ: ' + detailError.message);
      return;
    }

    setLoading(false);
    setValues({});
    setDone({ id: head.orgactlist_id as string, total });
  }

  return (
    <div className="max-w-[1150px] mx-auto px-8 py-8">
      {/* กล่องแจ้งผลหลังบันทึก พร้อมปุ่มไปหน้ารายงาน */}
      {done && (
        <Modal
          isOpen
          onClose={() => setDone(null)}
          title={isEdit ? 'บันทึกการแก้ไขเสร็จสิ้น' : 'บันทึกรายการและคำนวณเสร็จสิ้น'}
        >
          <div className="space-y-4 text-center">
            <div className="text-4xl text-[#16A34A]">✓</div>
            <p className="text-sm text-[#6B7280]">
              {isEdit
                ? 'ระบบบันทึกการแก้ไขและคำนวณใหม่เรียบร้อยแล้ว'
                : 'ระบบบันทึกรายการและคำนวณการปล่อยก๊าซเรียบร้อยแล้ว'}
            </p>
            <p className="text-2xl font-bold text-[#0F172A]">
              {done.total.toLocaleString('th-TH', { maximumFractionDigits: 2 })} tCO
              <sub>2</sub>e
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDone(null)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                ปิด
              </button>
              <Link
                href={`/organization/footprint/report/${done.id}`}
                className="rounded-lg bg-[#32885F] px-4 py-2 text-sm font-semibold text-white"
              >
                ดูรายงานการคำนวณ
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          {isEdit && (
            <Link
              href={`/organization/footprint/report/${existingLogId}`}
              className="text-sm text-[#6B7280] hover:underline"
            >
              ‹ กลับไปหน้ารายงาน
            </Link>
          )}
          <h1 className="text-[32px] font-medium text-black">
            {isEdit ? 'แก้ไขข้อมูลการปล่อยก๊าซเรือนกระจก' : 'กรอกข้อมูลการปล่อยก๊าซเรือนกระจก'}
          </h1>
          <p className="text-base font-medium text-[#6B7280]">
            {isEdit
              ? 'แก้ไขค่าที่เคยกรอก แล้วระบบจะคำนวณใหม่ให้'
              : 'ระบบจะคำนวณผลลัพธ์ตามค่าที่กรอก'}
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm font-bold text-[#6B7280]">
          ไตรมาสที่ 1 ›
        </span>
      </div>

      {/* Scope Sections */}
      <div className="flex flex-col gap-6">
        {scopeGroups.map((group) => (
          <div
            key={group.scope.scope_id}
            className="bg-white border border-[#BDC9C1] rounded-[25px] overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-[#F2F4F6] border-b border-[#BDC9C1] px-4 py-2">
              <span className="w-3 h-3 rounded-full bg-[#6FB898]" />
              <h2 className="text-base text-[#191C1E]">
                Scope {group.scope.scope_number}: {group.scope.scope_name}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 p-4">
              {group.details.length === 0 && (
                <p className="col-span-2 text-sm text-[#6B7280] py-4">
                  ยังไม่มีรายการให้กรอกในขอบเขตนี้
                </p>
              )}
              {group.details.map((detail) => (
                <div key={detail.scopedetail_id} className="space-y-1">
                  <label className="block text-xs text-[#3E4943] tracking-wide">
                    {detail.detail_name} {detail.unit ? `(${detail.unit})` : ''}
                  </label>
                  <div className="flex items-center justify-between bg-[#F7F9FB] border border-[#BDC9C1] rounded-[20px] h-11 px-[18px]">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={values[detail.scopedetail_id] ?? ''}
                      onChange={(e) => handleChange(detail.scopedetail_id, e.target.value)}
                      placeholder="0.00"
                      className="bg-transparent outline-none text-base text-[#191C1E] w-full"
                    />
                    <span className="text-base text-[#6B7280] whitespace-nowrap pl-2">
                      {detail.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleCalculate}
        disabled={loading}
        className="mt-8 w-[239px] h-[60px] rounded-[20px] bg-[#32885F] text-white text-base font-semibold tracking-wide disabled:opacity-60"
      >
        {loading
          ? 'กำลังบันทึก...'
          : isEdit
          ? 'บันทึกการแก้ไขและคำนวณใหม่'
          : 'คำนวณและดูรายงาน'}
      </button>
    </div>
  );
}