'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ScopeGroup } from '@/types/footprint';

export default function FootprintClient({ scopeGroups }: { scopeGroups: ScopeGroup[] }) {
  // เก็บค่าที่ผู้ใช้กรอก: key = scopedetail_id, value = ตัวเลขที่พิมพ์ (เป็น string ตอนอยู่ในฟอร์ม)
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleChange(scopedetailId: string, value: string) {
    setValues((prev) => ({ ...prev, [scopedetailId]: value }));
  }

  async function handleCalculate() {
    setLoading(true);

    // คำนวณ: sum ของ (ปริมาณที่กรอก × ค่า EF × ค่า GWP) ทุก activity_detail
    let totalKgCO2e = 0;
    for (const group of scopeGroups) {
      for (const detail of group.details) {
        const qty = parseFloat(values[detail.scopedetail_id] ?? '0') || 0;
        const ef = detail.emission_factor?.ef_value ?? 0;
        const gwp = detail.global_warming_potential?.gwp_value ?? 1;
        totalKgCO2e += qty * ef * gwp;
      }
    }
    const totalTCO2e = totalKgCO2e / 1000; // kgCO2e -> tCO2e

    // ⚠️ สมมติ org_id ไว้ก่อน (เหมือนหน้า Dashboard) — ต้องผูกกับ auth จริงทีหลัง
    const orgId = 'ใส่-org-id-ทดสอบ-ตรงนี้';

    const { error } = await supabase.from('org_activity_list').insert({
      org_id: orgId,
      orgact_name: `บันทึกการปล่อยก๊าซ — ${new Date().toLocaleDateString('th-TH')}`,
      total_ghg_emission: totalTCO2e,
      unit: 'tCO2e',
    });

    setLoading(false);

    if (error) {
      alert('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }

    alert(`คำนวณเสร็จแล้ว: ${totalTCO2e.toFixed(2)} tCO2e — บันทึกลงระบบแล้ว`);
  }

  return (
    <div className="max-w-[1150px] mx-auto px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-medium text-black">
            กรอกข้อมูลการปล่อยก๊าซเรือนกระจก
          </h1>
          <p className="text-base font-medium text-[#6B7280]">
            ระบบจะคำนวณผลลัพธ์ตามค่าที่กรอก
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
            {/* Header */}
            <div className="flex items-center gap-2 bg-[#F2F4F6] border-b border-[#BDC9C1] px-4 py-2">
              <span className="w-3 h-3 rounded-full bg-[#6FB898]" />
              <h2 className="text-base text-[#191C1E]">
                Scope {group.scope.scope_number}: {group.scope.scope_name}
              </h2>
            </div>

            {/* Input Grid */}
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

      {/* Calculate Button */}
      <button
        onClick={handleCalculate}
        disabled={loading}
        className="mt-8 w-[239px] h-[60px] rounded-[20px] bg-[#32885F] text-white text-base font-semibold tracking-wide disabled:opacity-60"
      >
        {loading ? 'กำลังคำนวณ...' : 'คำนวณและดูรายงาน'}
      </button>
    </div>
  );
}