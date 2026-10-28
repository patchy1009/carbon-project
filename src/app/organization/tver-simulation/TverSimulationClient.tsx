'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';
import type { OrgTreeProject, OrgTreeProjectDetail } from '@/types/tver-simulation';

// ⚠️ PLACEHOLDER: ยังไม่มีค่าอัตรากักเก็บคาร์บอนจริงต่อต้นในระบบ (tree_list ไม่มีคอลัมน์นี้)
// ต้องแทนที่ด้วยค่าจริงจาก DB เมื่อเพิ่มคอลัมน์ carbon_rate_kg_per_tree_per_year แล้ว
const PLACEHOLDER_KG_CO2E_PER_TREE_PER_YEAR = 10;
const GROWTH_RATE_YEAR_2 = 1.18; // +18% (ค่าสมมติตามตัวอย่างใน Figma)
const GROWTH_RATE_YEAR_3 = 1.38; // +38%

type CreditResult = { year1: number; year2: number; year3: number };

export default function TverSimulationClient({
  orgId,
  trees,
  criteria,
  existingProject = null,
  existingDetails = [],
}: {
  orgId: string; // auth.uid() ของบัญชีที่ล็อกอิน
  trees: TreeListItem[];
  criteria: TverProjectDetail[];
  existingProject?: OrgTreeProject | null; // ถ้ามีค่า = โหมดแก้ไขโครงการเดิม
  existingDetails?: OrgTreeProjectDetail[];
}) {
  const isEditMode = existingProject !== null;

  // ค่าเริ่มต้นของฟอร์ม: โหมดแก้ไขจะดึงจากโครงการเดิม โหมดสร้างใหม่จะว่างเปล่า
  const [projectName, setProjectName] = useState(existingProject?.project_name ?? '');

  // พันธุ์ไม้เก็บอยู่ในแถวรายละเอียดของโครงการ (org_tree_project_detail.tree_id) ทุกแถวมีค่าเดียวกัน
  const [treeId, setTreeId] = useState(existingDetails.find((d) => d.tree_id)?.tree_id ?? '');

  // ตารางเก็บแค่ปี (join_year) จึงเติมเป็นวันที่ 1 ม.ค. ของปีนั้นให้ในช่องวันที่
  const [startDate, setStartDate] = useState(
    existingProject?.join_year ? `${existingProject.join_year}-01-01` : ''
  );

  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const d of existingDetails) {
      if (d.tverdetail_id && d.amount !== null) initial[d.tverdetail_id] = String(d.amount);
    }
    return initial;
  });

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
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleAmountChange(tverdetailId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [tverdetailId]: value }));
  }

  // จับคู่ช่องกรอกกับชื่อ criteria ที่แอดมินตั้งไว้
  // ⚠️ เปราะบาง: ขึ้นกับว่าแอดมินตั้งชื่อ detail_name ตรงกับคำเหล่านี้
  const totalTreesDetail = criteria.find((c) => c.detail_name?.includes('จำนวนต้นไม้ที่ปลูก'));
  const areaDetail = criteria.find(
    (c) => c.detail_name?.includes('พื้นที่โครงการทั้งหมด') || c.detail_name?.includes('พื้นที่ปลูก')
  );
  const densityDetail = criteria.find((c) => c.detail_name?.includes('ต้นไม้ต่อไร่'));

  function valueOf(d?: TverProjectDetail): number {
    return d ? parseFloat(amounts[d.tverdetail_id] ?? '') || 0 : 0;
  }

  function calculateCredits(): CreditResult {
    // ใช้ "จำนวนต้นไม้ที่ปลูก" โดยตรงถ้ากรอกไว้ ถ้าไม่มีให้คำนวณจาก พื้นที่ x จำนวนต้นต่อไร่
    const plantedTrees = valueOf(totalTreesDetail);
    const totalTrees =
      plantedTrees > 0 ? plantedTrees : valueOf(areaDetail) * valueOf(densityDetail);

    const year1 = (totalTrees * PLACEHOLDER_KG_CO2E_PER_TREE_PER_YEAR) / 1000; // kg -> tCO2e
    return { year1, year2: year1 * GROWTH_RATE_YEAR_2, year3: year1 * GROWTH_RATE_YEAR_3 };
  }

  // กดปุ่ม "คำนวณและดูรายงาน": คำนวณ + บันทึกลงรายการโครงการในระบบ พร้อมกัน
  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    const credits = calculateCredits();

    const projectValues = {
      project_name: projectName,
      // ตัดปีจากข้อความวันที่โดยตรง (YYYY-MM-DD) ไม่ผ่าน Date เพื่อกันเขตเวลาทำให้ปีเพี้ยน
      join_year: startDate ? parseInt(startDate.slice(0, 4), 10) : null,
      credit_year_1: credits.year1,
      credit_year_2: credits.year2,
      credit_year_3: credits.year3,
      updated_at: new Date().toISOString(),
    };

    let projectId = savedProjectId;
    const isUpdate = projectId !== null;

    if (projectId) {
      // เคยบันทึกแล้ว -> อัปเดตโครงการเดิม ไม่สร้างซ้ำ
      const { error } = await supabase
        .from('org_tree_project')
        .update(projectValues)
        .eq('orgtreeproject_id', projectId);
      if (error) {
        setSaving(false);
        return alert('อัปเดตโครงการไม่สำเร็จ: ' + error.message);
      }

      // ลบรายละเอียดเดิมก่อน แล้วค่อยบันทึกชุดใหม่ด้านล่าง
      const { error: deleteError } = await supabase
        .from('org_tree_project_detail')
        .delete()
        .eq('orgtreeproject_id', projectId);
      if (deleteError) {
        setSaving(false);
        return alert('อัปเดตรายละเอียดไม่สำเร็จ: ' + deleteError.message);
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
        return alert('บันทึกโครงการไม่สำเร็จ: ' + error?.message);
      }
      projectId = data.orgtreeproject_id as string;
      setSavedProjectId(projectId); // จำไว้ เพื่อให้การกดครั้งต่อไปเป็นการอัปเดต
    }

    // บันทึกรายละเอียดแต่ละ criteria ที่กรอกไว้ (พร้อมพันธุ์ไม้ที่เลือก)
    const detailRows = criteria
      .filter((c) => (amounts[c.tverdetail_id] ?? '') !== '')
      .map((c) => ({
        orgtreeproject_id: projectId,
        tverdetail_id: c.tverdetail_id,
        tree_id: treeId || null,
        amount: parseFloat(amounts[c.tverdetail_id]) || 0,
        unit: c.unit,
      }));

    if (detailRows.length > 0) {
      const { error: detailError } = await supabase
        .from('org_tree_project_detail')
        .insert(detailRows);
      if (detailError) {
        setSaving(false);
        return alert('บันทึกรายละเอียดโครงการไม่สำเร็จ: ' + detailError.message);
      }
    }

    setResult(credits);
    setSaving(false);
    setNotice(
      isUpdate
        ? `อัปเดตโครงการ "${projectName}" ในรายการโครงการปลูกป่า T-VER เรียบร้อยแล้ว`
        : `โครงการ "${projectName}" ถูกบันทึกลงรายการโครงการปลูกป่า T-VER เรียบร้อยแล้ว`
    );
  }

  const maxValue = result ? Math.max(result.year1, result.year2, result.year3) : 0;
  const yAxisMax = Math.ceil(maxValue / 450) * 450 || 1800;

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {/* แจ้งเตือนหลังบันทึกสำเร็จ (ลอยอยู่บนจอ ไม่หายไปจนกว่าผู้ใช้จะปิดเอง) */}
      {notice && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-[560px] px-4">
          <div className="flex items-start gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 shadow-lg">
            <span className="mt-0.5 text-lg text-[#16A34A]">✓</span>
            <div className="flex-1 text-sm text-[#166534]">
              <p className="font-semibold">{notice}</p>
              <p className="mt-1">
                ไม่ต้องสร้างโครงการนี้ซ้ำ หากแก้ไขข้อมูลแล้วกดปุ่มอีกครั้ง
                ระบบจะอัปเดตโครงการเดิมให้
              </p>
              <Link
                href="/organization/dashboard"
                className="mt-2 inline-block font-semibold underline"
              >
                ดูในรายการโครงการ T-VER ›
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="ปิดการแจ้งเตือน"
              className="text-[#166534]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
        <form
          onSubmit={handleCalculate}
          className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-8 space-y-5"
        >
          <h2 className="text-xl font-bold text-[#1F2937]">ตั้งค่าโครงการปลูกป่า</h2>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#374151]">ชื่อโครงการ</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="เช่น โครงการปลูกป่าสัก ที่ราบสูงตอนเหนือ"
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-3 text-base"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#374151]">พันธุ์ไม้</label>
            <select
              value={treeId}
              onChange={(e) => setTreeId(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-3 text-base"
              required
            >
              <option value="">เลือกพันธุ์ไม้</option>
              {trees.map((t) => (
                <option key={t.tree_id} value={t.tree_id}>
                  {t.tree_name}
                </option>
              ))}
            </select>
          </div>

          {/* ช่องกรอกแบบไดนามิกตามเงื่อนไขที่แอดมินตั้งไว้ */}
          <div className="grid grid-cols-2 gap-4">
            {criteria.map((c) => (
              <div key={c.tverdetail_id} className="space-y-2">
                <label className="block text-sm font-semibold text-[#374151]">
                  {c.detail_name} {c.unit ? `(${c.unit})` : ''}
                </label>
                <input
                  type="number"
                  step="any"
                  value={amounts[c.tverdetail_id] ?? ''}
                  onChange={(e) => handleAmountChange(c.tverdetail_id, e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-3 text-base"
                  required
                />
                {c.condition_value && (
                  <p className="text-xs text-[#9CA3AF]">เงื่อนไข: {c.condition_value}</p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#374151]">วันที่เริ่มโครงการ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-3 text-base"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-[239px] h-[60px] rounded-[20px] bg-[#32885F] text-white text-base font-semibold disabled:opacity-60"
          >
            {saving
              ? 'กำลังบันทึก...'
              : savedProjectId
              ? 'คำนวณและอัปเดตโครงการ'
              : 'คำนวณและดูรายงาน'}
          </button>
        </form>

        {/* ขวา: ผลลัพธ์ */}
        <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-8">
          <h2 className="text-xl font-bold text-[#1F2937]">การประมาณคาร์บอนเครดิต 3 ปี</h2>
          <p className="text-sm text-[#9CA3AF] mb-8">tCO2e ที่เกิดขึ้นในต่อรอบบัญชี</p>

          {!result && (
            <p className="text-center text-[#9CA3AF] py-20">
              กรอกข้อมูลด้านซ้ายแล้วกด &quot;คำนวณและดูรายงาน&quot; เพื่อดูผลลัพธ์
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}