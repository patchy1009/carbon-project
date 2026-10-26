'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';
import FootprintStepper from '@/components/FootprintStepper';
import type { ScopeGroup } from '@/types/footprint';

export type ExistingBill = {
  bill_id: string;
  bill_type: string;
  file_path: string;
  original_name: string | null;
  file_size: number | null;
};

type PendingBill = { id: string; file: File; type: string };

const BILL_TYPES = [
  { value: 'electricity', label: 'บิลค่าไฟฟ้า' },
  { value: 'water', label: 'บิลค่าน้ำ' },
  { value: 'fuel', label: 'บิลน้ำมันเชื้อเพลิง' },
  { value: 'other', label: 'เอกสารอื่นๆ' },
];
const billLabel = (v: string) => BILL_TYPES.find((t) => t.value === v)?.label ?? v;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB ตรงกับที่ตั้งไว้ที่ bucket
const MAX_FILES = 10;

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const fmtSize = (n: number | null) =>
  n === null ? '' : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * ===== จุดต่อ OCR ในอนาคต =====
 * ฟังก์ชันนี้ถูกเรียกทุกครั้งหลังผู้ใช้เลือกไฟล์บิล
 * ถ้าทำ OCR แล้ว ให้ส่งไฟล์ไปอ่าน แล้วคืนค่าเป็น { scopedetail_id: 'ตัวเลขที่อ่านได้' }
 * ระบบจะเติมลงช่องกรอกให้อัตโนมัติ และผู้ใช้ยังแก้ไขเองได้ (เป็นทางเลือกแทนการพิมพ์)
 * ตอนนี้คืน null = ยังไม่อ่านอะไร
 */
async function extractFromBill(
  _file: File,
  _billType: string
): Promise<Record<string, string> | null> {
  return null;
}

export default function FootprintClient({
  scopeGroups,
  orgId,
  existingLogId = null, // มีค่า = โหมดแก้ไขรายการเดิม
  existingValues = {},  // ค่าที่เคยกรอก key = scopedetail_id
  existingBills = [],   // บิลที่เคยแนบไว้
  hasOfficeInfo = true,
}: {
  scopeGroups: ScopeGroup[];
  orgId: string;
  existingLogId?: string | null;
  existingValues?: Record<string, string>;
  existingBills?: ExistingBill[];
  hasOfficeInfo?: boolean;
}) {
  const isEdit = existingLogId !== null;

  const [values, setValues] = useState<Record<string, string>>(existingValues);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);

  // ส่วนแนบบิล
  const [pending, setPending] = useState<PendingBill[]>([]);
  const [saved, setSaved] = useState<ExistingBill[]>(existingBills);
  const [billType, setBillType] = useState('electricity');

  function handleChange(scopedetailId: string, value: string) {
    setValues((prev) => ({ ...prev, [scopedetailId]: value }));
  }

  // ---------- แนบไฟล์บิล ----------
  async function applyOcr(item: PendingBill) {
    const result = await extractFromBill(item.file, item.type);
    if (result) setValues((prev) => ({ ...prev, ...result }));
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้

    const accepted: PendingBill[] = [];
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        alert(`ไฟล์ "${f.name}" ไม่รองรับ (รองรับ JPG, PNG, WEBP และ PDF)`);
        continue;
      }
      if (f.size === 0) {
        alert(`ไฟล์ "${f.name}" ว่างเปล่า`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        alert(`ไฟล์ "${f.name}" ใหญ่เกิน 10 MB`);
        continue;
      }
      accepted.push({ id: uid(), file: f, type: billType });
    }

    if (pending.length + saved.length + accepted.length > MAX_FILES) {
      alert(`แนบไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์ต่อรายการ`);
      return;
    }
    setPending((prev) => [...prev, ...accepted]);
    accepted.forEach((a) => void applyOcr(a));
  }

  async function openSaved(b: ExistingBill) {
    const { data, error } = await supabase.storage
      .from('bills')
      .createSignedUrl(b.file_path, 120); // ลิงก์ใช้ได้ 2 นาที
    if (error || !data) return alert('เปิดไฟล์ไม่สำเร็จ: ' + error?.message);
    window.open(data.signedUrl, '_blank');
  }

  async function deleteSaved(b: ExistingBill) {
    if (!confirm(`ลบไฟล์ "${b.original_name ?? 'บิล'}" ?`)) return;
    const { error: stErr } = await supabase.storage.from('bills').remove([b.file_path]);
    if (stErr) return alert('ลบไฟล์ไม่สำเร็จ: ' + stErr.message);
    const { error } = await supabase.from('org_bill_file').delete().eq('bill_id', b.bill_id);
    if (error) return alert('ลบข้อมูลไฟล์ไม่สำเร็จ: ' + error.message);
    setSaved((prev) => prev.filter((x) => x.bill_id !== b.bill_id));
  }

  // อัปโหลดบิลที่รอแนบ (หลังบันทึกรายการสำเร็จแล้ว) คืนจำนวนไฟล์ที่ไม่สำเร็จ
  async function uploadPending(logId: string): Promise<number> {
    let failed = 0;
    const uploaded: ExistingBill[] = [];

    for (const item of pending) {
      const ext = item.file.name.includes('.')
        ? item.file.name.split('.').pop()!.toLowerCase()
        : 'bin';
      // ชื่อไฟล์ในที่เก็บสร้างใหม่ (ไม่ใช้ชื่อเดิม กันปัญหาภาษาไทย/อักขระพิเศษ) เก็บชื่อเดิมไว้ในตาราง
      const path = `${orgId}/${logId}/${uid()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('bills')
        .upload(path, item.file, { contentType: item.file.type, upsert: false });
      if (upErr) {
        console.error('Upload bill error:', upErr);
        failed++;
        continue;
      }

      const { data: row, error: rowErr } = await supabase
        .from('org_bill_file')
        .insert({
          org_id: orgId,
          orgactlist_id: logId,
          bill_type: item.type,
          file_path: path,
          original_name: item.file.name,
          mime_type: item.file.type,
          file_size: item.file.size,
        })
        .select('bill_id, bill_type, file_path, original_name, file_size')
        .single();

      if (rowErr || !row) {
        console.error('Insert bill row error:', rowErr);
        await supabase.storage.from('bills').remove([path]); // ไม่ให้เหลือไฟล์กำพร้า
        failed++;
        continue;
      }
      uploaded.push(row as ExistingBill);
    }

    setSaved((prev) => [...prev, ...uploaded]);
    setPending([]);
    return failed;
  }

  // ---------- คำนวณและบันทึก ----------
  async function handleCalculate() {
    setLoading(true);

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
    let logId: string;

    if (isEdit && existingLogId) {
      // ===== โหมดแก้ไข =====
      logId = existingLogId;

      const { data: oldRows, error: oldError } = await supabase
        .from('org_activity_detail')
        .select('orgactdetail_id')
        .eq('orgactlist_id', logId);
      if (oldError) {
        setLoading(false);
        return alert('อ่านรายละเอียดเดิมไม่สำเร็จ: ' + oldError.message);
      }

      // เพิ่มชุดใหม่ก่อน ถ้าล้มเหลวข้อมูลเดิมยังอยู่ครบ
      const { error: insError } = await supabase
        .from('org_activity_detail')
        .insert(rows.map((r) => ({ orgactlist_id: logId, ...r })));
      if (insError) {
        setLoading(false);
        return alert('บันทึกรายละเอียดไม่สำเร็จ: ' + insError.message);
      }

      const oldIds = (oldRows ?? []).map((r: any) => r.orgactdetail_id as string);
      if (oldIds.length > 0) {
        const { error: delError } = await supabase
          .from('org_activity_detail')
          .delete()
          .in('orgactdetail_id', oldIds);
        if (delError) {
          setLoading(false);
          return alert('ลบรายละเอียดเดิมไม่สำเร็จ: ' + delError.message);
        }
      }

      const { error: updError } = await supabase
        .from('org_activity_list')
        .update({ total_ghg_emission: total, updated_at: new Date().toISOString() })
        .eq('orgactlist_id', logId)
        .eq('org_id', orgId);
      if (updError) {
        setLoading(false);
        return alert('อัปเดตยอดรวมไม่สำเร็จ: ' + updError.message);
      }
    } else {
      // ===== โหมดสร้างใหม่ =====
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
        return alert('บันทึกไม่สำเร็จ: ' + headError?.message);
      }
      logId = head.orgactlist_id as string;

      const { error: detailError } = await supabase
        .from('org_activity_detail')
        .insert(rows.map((r) => ({ orgactlist_id: logId, ...r })));
      if (detailError) {
        await supabase.from('org_activity_list').delete().eq('orgactlist_id', logId);
        setLoading(false);
        return alert('บันทึกรายละเอียดไม่สำเร็จ: ' + detailError.message);
      }
    }

    // อัปโหลดบิลที่แนบ (ทำหลังบันทึกรายการสำเร็จ ถ้าบิลล้มเหลวรายการยังอยู่ครบ)
    if (pending.length > 0) {
      const failed = await uploadPending(logId);
      if (failed > 0) {
        alert(
          `บันทึกรายการเรียบร้อย แต่แนบไฟล์ไม่สำเร็จ ${failed} ไฟล์ ` +
            `(กดแก้ไขข้อมูลเพื่อแนบใหม่ได้)`
        );
      }
    }

    setLoading(false);
    if (!isEdit) setValues({});
    setDone({ id: logId, total });
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

      {/* หัวหน้า */}
      <div className="mb-4">
        {isEdit && (
          <Link
            href={`/organization/footprint/report/${existingLogId}`}
            className="text-sm text-[#6B7280] hover:underline"
          >
            ‹ กลับไปหน้ารายงาน
          </Link>
        )}
        <h1 className="text-[32px] font-medium text-black">
          {isEdit ? 'แก้ไขข้อมูลการปล่อยก๊าซเรือนกระจก' : 'วิเคราะห์การปล่อยก๊าซเรือนกระจก'}
        </h1>
      </div>

      <FootprintStepper current={2} />

      {/* เตือนถ้ายังไม่ได้กรอกข้อมูลสำนักงาน (ไม่บังคับ) */}
      {!hasOfficeInfo && !isEdit && (
        <div className="mb-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          ยังไม่ได้กรอกข้อมูลสำนักงาน{' '}
          <Link href="/organization/footprint" className="font-semibold underline">
            กรอกข้อมูลสำนักงาน
          </Link>
        </div>
      )}

      {/* ส่วนแนบบิล */}
      <div className="mb-6 overflow-hidden rounded-[25px] border border-[#BDC9C1] bg-white">
        <div className="flex items-center gap-2 border-b border-[#BDC9C1] bg-[#F2F4F6] px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-[#6FB898]" />
          <h2 className="text-base text-[#191C1E]">แนบบิลและเอกสารประกอบ (ไม่บังคับ)</h2>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-xs text-[#6B7280]">
            แนบรูปหรือไฟล์ PDF ของบิลค่าไฟ ค่าน้ำ ค่าน้ำมัน เก็บเป็นหลักฐานประกอบรายการ
            (JPG, PNG, WEBP, PDF ไม่เกิน 10 MB ต่อไฟล์) ในอนาคตระบบจะอ่านค่าจากบิลให้อัตโนมัติ
            เป็นอีกทางเลือกแทนการพิมพ์เอง
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={billType}
              onChange={(e) => setBillType(e.target.value)}
              className="h-11 rounded-[20px] border border-[#BDC9C1] bg-[#F7F9FB] px-4 text-sm"
            >
              {BILL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <label className="flex h-11 cursor-pointer items-center rounded-[20px] bg-[#32885F] px-5 text-sm font-semibold text-white">
              เลือกไฟล์
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFiles}
                className="hidden"
              />
            </label>

            <button
              type="button"
              disabled
              title="เร็วๆ นี้"
              className="h-11 cursor-not-allowed rounded-[20px] border border-dashed border-[#BDC9C1] px-5 text-sm text-[#94A3B8]"
            >
              
            </button>
          </div>

          {/* บิลที่เคยบันทึกไว้แล้ว */}
          {saved.length > 0 && (
            <ul className="space-y-2">
              {saved.map((b) => (
                <li
                  key={b.bill_id}
                  className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm"
                >
                  <span>
                    <span className="mr-2 rounded bg-[#F0FDF4] px-2 py-0.5 text-xs text-[#16A34A]">
                      {billLabel(b.bill_type)}
                    </span>
                    {b.original_name ?? 'บิล'}{' '}
                    <span className="text-xs text-[#94A3B8]">{fmtSize(b.file_size)}</span>
                  </span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => openSaved(b)}
                      className="text-[#32885F] hover:underline"
                    >
                      เปิดดู
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSaved(b)}
                      className="text-[#94A3B8] hover:text-red-500"
                    >
                      ลบ
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* ไฟล์ที่เลือกไว้ รอบันทึก */}
          {pending.length > 0 && (
            <ul className="space-y-2">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-dashed border-[#6FB898] bg-[#F7FDFA] px-4 py-2 text-sm"
                >
                  <span>
                    <span className="mr-2 rounded bg-white px-2 py-0.5 text-xs text-[#16A34A]">
                      {billLabel(p.type)}
                    </span>
                    {p.file.name}{' '}
                    <span className="text-xs text-[#94A3B8]">{fmtSize(p.file.size)}</span>
                    <span className="ml-2 text-xs text-[#92400E]">(จะแนบเมื่อกดบันทึก)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                    className="text-[#94A3B8] hover:text-red-500"
                  >
                    เอาออก
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Scope Sections */}
      <div className="flex flex-col gap-6">
        {scopeGroups.map((group) => (
          <div
            key={group.scope.scope_id}
            className="overflow-hidden rounded-[25px] border border-[#BDC9C1] bg-white"
          >
            <div className="flex items-center gap-2 border-b border-[#BDC9C1] bg-[#F2F4F6] px-4 py-2">
              <span className="h-3 w-3 rounded-full bg-[#6FB898]" />
              <h2 className="text-base text-[#191C1E]">
                Scope {group.scope.scope_number}: {group.scope.scope_name}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 p-4">
              {group.details.length === 0 && (
                <p className="col-span-2 py-4 text-sm text-[#6B7280]">
                  ยังไม่มีรายการให้กรอกในขอบเขตนี้
                </p>
              )}
              {group.details.map((detail) => (
                <div key={detail.scopedetail_id} className="space-y-1">
                  <label className="block text-xs tracking-wide text-[#3E4943]">
                    {detail.detail_name} {detail.unit ? `(${detail.unit})` : ''}
                  </label>
                  <div className="flex h-11 items-center justify-between rounded-[20px] border border-[#BDC9C1] bg-[#F7F9FB] px-[18px]">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={values[detail.scopedetail_id] ?? ''}
                      onChange={(e) => handleChange(detail.scopedetail_id, e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent text-base text-[#191C1E] outline-none"
                    />
                    <span className="whitespace-nowrap pl-2 text-base text-[#6B7280]">
                      {detail.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <Link
          href={isEdit ? `/organization/footprint?edit=${existingLogId}` : '/organization/footprint'}
          className="flex h-[60px] items-center rounded-[20px] border border-[#BDC9C1] px-8 text-base font-semibold text-[#64748B]"
        >
          กลับ
        </Link>
        <button
          onClick={handleCalculate}
          disabled={loading}
          className="h-[60px] w-[280px] rounded-[20px] bg-[#32885F] text-base font-semibold tracking-wide text-white disabled:opacity-60"
        >
          {loading
            ? 'กำลังบันทึก...'
            : isEdit
            ? 'บันทึกการแก้ไขและคำนวณใหม่'
            : 'คำนวณและดูรายงาน'}
        </button>
      </div>
    </div>
  );
}