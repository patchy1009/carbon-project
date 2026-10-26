'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import FootprintStepper from '@/components/FootprintStepper';

export type OfficeInfoType = {
  info_id: string;
  info_name: string | null;
  unit: string | null;
  info_detail: string | null;
};
export type SavedInfo = {
  orginfo_id: string;
  info_id: string | null;
  amount: string | null;
};

// ตารางไม่มีคอลัมน์ "ชนิดข้อมูล" จึงเดาจากหน่วย:
//   ไม่มีหน่วย → ข้อความ | หน่วยมี % → เปอร์เซ็นต์ (0-100) | มีหน่วยอื่น → ตัวเลข
type Kind = 'text' | 'number' | 'percent';
const kindOf = (t: OfficeInfoType): Kind =>
  !t.unit?.trim() ? 'text' : t.unit.includes('%') ? 'percent' : 'number';

// แปลงเลขไทย ลบ comma และช่องว่าง
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const cleanNumber = (v: string) =>
  v
    .trim()
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/,/g, '')
    .replace(/\s/g, '');

function validate(types: OfficeInfoType[], form: Record<string, string>) {
  const errors: Record<string, string> = {};
  const clean: Record<string, string> = {};

  for (const t of types) {
    const label = t.info_name ?? 'ข้อมูลนี้';
    const kind = kindOf(t);
    const raw = form[t.info_id] ?? '';

    if (kind === 'text') {
      const v = raw.replace(/\s+/g, ' ').trim();
      if (v.length > 255) errors[t.info_id] = `${label}ยาวเกิน 255 ตัวอักษร`;
      clean[t.info_id] = v;
      continue;
    }

    const v = cleanNumber(raw);
    clean[t.info_id] = v;
    if (v === '') continue; // ไม่บังคับกรอก
    if (!/^\d+(\.\d+)?$/.test(v)) {
      errors[t.info_id] = `${label}ต้องเป็นตัวเลขที่ไม่ติดลบ`;
    } else if (kind === 'percent' && Number(v) > 100) {
      errors[t.info_id] = `${label}ต้องอยู่ระหว่าง 0-100`;
    }
  }
  return { errors, clean };
}

export default function OfficeInfoClient({
  orgId,
  editId = null, // มีค่า = โหมดแก้ไขรายการเดิม ต้องพกไปขั้นที่ 2
  types,
  saved: savedRows,
}: {
  orgId: string;
  editId?: string | null;
  types: OfficeInfoType[];
  saved: SavedInfo[];
}) {
  const router = useRouter();
  const nextHref = editId
    ? `/organization/footprint/activity?edit=${editId}`
    : '/organization/footprint/activity';

  // แถวที่บันทึกไว้แล้ว: key = info_id (เก็บไว้เพื่อรู้ว่าต้อง "อัปเดต" หรือ "เพิ่มใหม่")
  const [saved, setSaved] = useState<Record<string, { orginfo_id: string; amount: string }>>(() => {
    const m: Record<string, { orginfo_id: string; amount: string }> = {};
    for (const r of savedRows) {
      if (r.info_id) m[r.info_id] = { orginfo_id: r.orginfo_id, amount: r.amount ?? '' };
    }
    return m;
  });

  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of types) init[t.info_id] = saved[t.info_id]?.amount ?? '';
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openHint, setOpenHint] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  function setField(id: string, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  }

  async function handleNext(e: React.FormEvent) {
    e.preventDefault();

    const { errors: errs, clean } = validate(types, form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      alert('กรุณาตรวจสอบข้อมูลที่กรอก (ช่องที่มีข้อความสีแดง)');
      return;
    }

    setSaving(true);
    const next = { ...saved }; // อัปเดตตามที่สำเร็จจริง กันบันทึกซ้ำถ้าล้มกลางทาง
    let failMessage: string | null = null;

    try {
      // แยกว่าแต่ละหัวข้อต้อง เพิ่ม / แก้ / ลบ
      const toInsert: { org_id: string; info_id: string; amount: string }[] = [];
      const toUpdate: { info_id: string; orginfo_id: string; amount: string }[] = [];
      const toDelete: { info_id: string; orginfo_id: string }[] = [];

      for (const t of types) {
        const value = clean[t.info_id];
        const ex = next[t.info_id];
        if (value === '') {
          if (ex) toDelete.push({ info_id: t.info_id, orginfo_id: ex.orginfo_id });
        } else if (!ex) {
          toInsert.push({ org_id: orgId, info_id: t.info_id, amount: value });
        } else if (ex.amount !== value) {
          toUpdate.push({ info_id: t.info_id, orginfo_id: ex.orginfo_id, amount: value });
        }
      }

      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from('org_office_info')
          .insert(toInsert)
          .select('orginfo_id, info_id, amount');
        if (error) throw error;
        for (const r of data ?? []) {
          if (r.info_id) next[r.info_id] = { orginfo_id: r.orginfo_id, amount: r.amount ?? '' };
        }
      }

      for (const u of toUpdate) {
        const { error } = await supabase
          .from('org_office_info')
          .update({ amount: u.amount, updated_at: new Date().toISOString() })
          .eq('orginfo_id', u.orginfo_id)
          .eq('org_id', orgId);
        if (error) throw error;
        next[u.info_id] = { orginfo_id: u.orginfo_id, amount: u.amount };
      }

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('org_office_info')
          .delete()
          .in('orginfo_id', toDelete.map((d) => d.orginfo_id))
          .eq('org_id', orgId);
        if (error) throw error;
        for (const d of toDelete) delete next[d.info_id];
      }
    } catch (err) {
      failMessage = (err as { message?: string }).message ?? 'ไม่ทราบสาเหตุ';
    } finally {
      setSaved(next);
      setSaving(false);
    }

    if (failMessage) {
      alert('บันทึกข้อมูลสำนักงานไม่สำเร็จ: ' + failMessage);
      return;
    }
    router.push(nextHref);
  }

  return (
    <form onSubmit={handleNext} noValidate className="max-w-[1150px] mx-auto px-8 py-8">
      <h1 className="mb-4 text-[32px] font-medium text-black">วิเคราะห์การปล่อยก๊าซเรือนกระจก</h1>
      <FootprintStepper current={1} />

      <div className="overflow-hidden rounded-[25px] border border-[#BDC9C1] bg-white">
        <div className="flex items-center gap-2 border-b border-[#BDC9C1] bg-[#F2F4F6] px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-[#6FB898]" />
          <h2 className="text-base text-[#191C1E]">ข้อมูลสำนักงาน</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-4">
          {types.length === 0 && (
            <p className="col-span-2 py-6 text-center text-sm text-[#6B7280]">
              ผู้ดูแลระบบยังไม่ได้ตั้งค่าหัวข้อข้อมูลสำนักงาน สามารถข้ามไปขั้นตอนถัดไปได้
            </p>
          )}

          {types.map((t) => {
            const kind = kindOf(t);
            const err = errors[t.info_id];
            return (
              <div key={t.info_id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs tracking-wide text-[#3E4943]">
                    {t.info_name}
                    {t.unit ? ` (${t.unit})` : ''}
                  </label>
                  {t.info_detail && (
                    <button
                      type="button"
                      onClick={() => setOpenHint((p) => ({ ...p, [t.info_id]: !p[t.info_id] }))}
                      aria-label="ดูคำอธิบาย"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6FDBF5] text-xs font-bold text-white"
                    >
                      i
                    </button>
                  )}
                </div>

                <div
                  className={`flex h-11 items-center justify-between rounded-[20px] border bg-[#F7F9FB] px-[18px] ${
                    err ? 'border-red-500' : 'border-[#BDC9C1]'
                  }`}
                >
                  <input
                    type="text"
                    inputMode={kind === 'text' ? 'text' : 'decimal'}
                    value={form[t.info_id] ?? ''}
                    onChange={(e) => setField(t.info_id, e.target.value)}
                    placeholder={kind === 'text' ? '' : '0.00'}
                    className="w-full bg-transparent text-base text-[#191C1E] outline-none"
                  />
                  {t.unit && (
                    <span className="whitespace-nowrap pl-2 text-base text-[#6B7280]">{t.unit}</span>
                  )}
                </div>

                {err && <p className="text-xs text-red-600">{err}</p>}
                {openHint[t.info_id] && t.info_detail && (
                  <p className="whitespace-pre-line rounded-xl bg-[#F2F4F6] px-3 py-2 text-xs text-[#4B5563]">
                    {t.info_detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="h-[60px] rounded-full bg-[#32885F] px-8 text-base font-semibold tracking-wide text-white disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก...' : 'กรอกข้อมูลการดำเนินกิจกรรม'}
        </button>
        <Link href={nextHref} className="text-sm text-[#6B7280] underline">
          ข้ามขั้นตอนนี้
        </Link>
      </div>
    </form>
  );
}