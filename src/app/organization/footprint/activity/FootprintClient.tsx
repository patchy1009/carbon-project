'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';
import FootprintStepper from '@/components/FootprintStepper';
import YearPicker from '@/components/YearPicker';
import type { ScopeGroup } from '@/types/footprint';
import BillRow from '@/components/bills/BillRow';
import YearlySummary from '@/components/bills/YearlySummary';
import { useBillOcr, type PendingBill } from '@/lib/bills/useBillOcr';
import { checkBill, type BillTarget } from '@/lib/bills/checks';
import { summarize, fillValue, formatQty, type GapChoice, type GapState } from '@/lib/bills/aggregate';
import { ocrSourceOf, type ActivityPeriod, type BillType, type OcrSource } from '@/lib/bills/types';
import { validateForm, required, notNumericOnly, maxLength, isDecimal, type formSchema } from '@/lib/validation';
import { normalizeNumberString, normalizeToArabicNumber } from '@/lib/normalization';
import { clearOfficeDraft, draftScope, hasOfficeValues, readOfficeDraft } from '@/lib/officeDraft';
import { showAlert, showConfirm, showError } from '@/lib/dialog'; // [แก้ไข] กล่องแจ้งเตือนกลางแทน alert/confirm

/* [ปรับปรุง] แนบบิล = OCR ช่วยกรอก (Auto-fill) อย่างเดียว ไม่เก็บรูปบิลลง Supabase แล้ว
 *   แนบรูป -> POST /api/ocr (PaddleOCR) -> ตรวจแก้ใน BillRow -> กด "ยืนยัน"
 *   -> รวมยอดตามช่องกิจกรรม (activity_detail.ocr_source) -> กด "เติมลงฟอร์ม" -> คำนวณด้วยสูตรเดิม
 * ระบบแนบบิลเดิม (Storage 'bills' + ตาราง org_bill_file) ถูกคอมเมนต์ไว้ด้านล่าง ข้อมูลเก่าใน Supabase ยังอยู่ */

/* [ปรับปรุง] normalize / validate ช่องที่ผู้ใช้กรอกเอง (ไม่รวมส่วน OCR ของบิล)
 * 1) ชื่อกิจกรรม: normalizeText + ห้ามว่าง + ห้ามเป็นตัวเลขล้วน + ยาวไม่เกิน NAME_MAX
 * 2) ปริมาณแต่ละรายการ: เดิมใช้ parseFloat ซึ่งรับ "12abc" เป็น 12 และข้ามค่าติดลบแบบเงียบๆ
 *    ตอนนี้ แปลงเลขไทย/ลบ comma -> ต้องเป็นตัวเลข ไม่ติดลบ ทศนิยมไม่เกิน 4 หลัก แสดง error ใต้ช่อง
 * 3) ตรวจความสัมพันธ์: รายการที่กรอกต้องมีค่า EF ที่แอดมินผูกไว้ (ไม่งั้นผลคำนวณเป็น 0 โดยไม่รู้ตัว)
 * 4) ช่องปริมาณเปลี่ยนจาก type="number" เป็น text + inputMode="decimal" เพื่อรับเลขไทย */
const AMOUNT_MAX_DECIMALS = 4;

// [ปิดใช้งาน] บิลที่เคยบันทึกไว้ใน org_bill_file (ไม่โหลด/ไม่แสดงแล้ว)
// export type ExistingBill = { bill_id: string; bill_type: string; file_path: string; original_name: string | null; file_size: number | null };

type PeriodType = 'month' | 'year';

// หมวดบิลที่ให้แนบ (เรียงตามที่แสดง)
const BILL_CATEGORIES: { value: BillType; label: string; hint: string }[] = [
  { value: 'water', label: 'บิลค่าน้ำ', hint: 'ใบแจ้งหนี้ค่าน้ำประปา' },
  { value: 'electricity', label: 'บิลค่าไฟฟ้า', hint: 'ใบแจ้งหนี้ค่าไฟฟ้า' },
  { value: 'fuel', label: 'บิลน้ำมันเชื้อเพลิง', hint: 'ใบเสร็จหรือใบกำกับภาษีจากปั๊มน้ำมัน (แนบได้หลายใบต่อเดือน ระบบรวมยอดให้)' },
];
const billLabel = (v: string) => BILL_CATEGORIES.find((t) => t.value === v)?.label ?? v;

// [แก้ไข] Python OCR รับเฉพาะรูป (ไม่รับ PDF) และไม่เกิน 10 MB ตรงกับ /api/ocr และ api.py
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
// จำนวนไฟล์สูงสุดต่อหมวด (ปรับได้ตามต้องการ)
const MAX_PER_TYPE: Record<PeriodType, number> = { month: 10, year: 50 };

// ใช้จับไฟล์ซ้ำที่เลือกซ้ำในหน้าเดียวกัน
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

// ไอคอนถังขยะ
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

// ---------- ช่วงเวลา (เดือน/ปี) ----------
const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const pad2 = (n: number) => String(n).padStart(2, '0');

// เก็บใน DB เป็น 'YYYY-MM-01' (ค.ศ.) ; รายปีใช้ 1 ม.ค.
function derivePeriod(type: PeriodType, month: number, yearBE: number): string {
  if (!yearBE) return '';
  if (type === 'year') return `${yearBE - 543}-01-01`;
  return month ? `${yearBE - 543}-${pad2(month)}-01` : '';
}
const monthOf = (p: string) => (p ? Number(p.slice(5, 7)) : 0);
const yearBEOf = (p: string) => (p ? Number(p.slice(0, 4)) + 543 : 0);

// ชื่อที่ระบบแนะนำ: "คาร์บอนฟุตพรินต์ มี.ค.69" หรือ "คาร์บอนฟุตพรินต์ ปี 2569"
function defaultName(type: PeriodType, p: string): string {
  if (!p) return '';
  if (type === 'year') return `คาร์บอนฟุตพรินต์ ปี ${yearBEOf(p)}`;
  return `คาร์บอนฟุตพรินต์ ${TH_MONTHS_SHORT[monthOf(p) - 1]}${String(yearBEOf(p)).slice(-2)}`;
}
function periodLabel(type: PeriodType, p: string): string {
  return type === 'year'
    ? `ปี ${yearBEOf(p)}`
    : `${TH_MONTHS_FULL[monthOf(p) - 1]} ${yearBEOf(p)}`;
}

const NAME_MAX = 100;

export default function FootprintClient({
  scopeGroups,
  orgId,
  existingLogId = null,       // มีค่า = โหมดแก้ไขรายการเดิม
  existingValues = {},        // ค่าที่เคยกรอก key = scopedetail_id
  existingName = '',          // ชื่อกิจกรรมเดิม (orgact_name)
  existingPeriod = '',        // 'YYYY-MM-DD' (period_month)
  existingPeriodType = 'month',
}: {
  scopeGroups: ScopeGroup[];
  orgId: string;
  existingLogId?: string | null;
  existingValues?: Record<string, string>;
  existingName?: string;
  existingPeriod?: string;
  existingPeriodType?: PeriodType;
}) {
  const isEdit = existingLogId !== null;
  // ลิงก์ย้อนกลับไปขั้นที่ 1 (ปุ่มกลับ และลิงก์เตือนข้อมูลสำนักงาน)
  // ?resume=1 = เอาค่าที่กรอกไว้กลับมา ไม่ล้างเหมือนเข้ามาใหม่ / ?edit= = ยังอยู่ในโหมดแก้ไขรายการเดิม
  const backHref = isEdit
    ? `/organization/footprint?edit=${existingLogId}&resume=1`
    : '/organization/footprint?resume=1';

  // [แก้ไข] รายการใหม่: ดูว่ากรอกข้อมูลสำนักงานในขั้นที่ 1 ไว้ไหม (ค่าที่ค้างใน sessionStorage)
  // ฝั่ง server ถือว่ามี เพื่อไม่ให้กล่องเตือนกะพริบตอนโหลด
  const hasOfficeInfo = useSyncExternalStore(
    () => () => {},
    () => hasOfficeValues(readOfficeDraft(orgId, 'new')),
    () => true,
  );

  const [values, setValues] = useState<Record<string, string>>(existingValues);
  // [เพิ่ม] error ใต้ช่อง: key = 'name' หรือ scopedetail_id
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);

  // ชื่อกิจกรรม + ช่วงเวลา
  const [name, setName] = useState<string>(existingName);
  // true = ผู้ใช้พิมพ์ชื่อเอง (หรือเป็นชื่อเดิมจากโหมดแก้ไข) ห้ามเขียนทับอัตโนมัติ
  const [nameTouched, setNameTouched] = useState<boolean>(isEdit && existingName.trim() !== '');
  const [periodType, setPeriodType] = useState<PeriodType>(existingPeriodType);
  const [selMonth, setSelMonth] = useState<number>(
    existingPeriodType === 'month' ? monthOf(existingPeriod) : 0
  );
  const [selYear, setSelYear] = useState<number>(yearBEOf(existingPeriod));
  const periodMonth = derivePeriod(periodType, selMonth, selYear); // ค่าที่จะบันทึก

  // ส่วนแนบบิล
  const maxPerType = MAX_PER_TYPE[periodType];

  // ตัวเลือกปี พ.ศ.: ย้อนหลัง 5 ปี ไปข้างหน้า 1 ปี (รวมปีของรายการเดิมถ้าอยู่นอกช่วง)
  const nowBE = new Date().getFullYear() + 543;

  // อ่านบิลด้วย OCR + ตรวจเดือน/ซ้ำ (ถ้ายังไม่เลือกเดือน ใช้ค่าสำรองเพื่อไม่ให้แถวบิลพัง)
  const ocrPeriod: ActivityPeriod = {
    type: periodType,
    month: periodMonth || `${(selYear || nowBE) - 543}-01-01`,
  };
  const bills = useBillOcr();

  // [เพิ่ม] ช่องกิจกรรมที่รับข้อมูลจากบิล: จับคู่ด้วย activity_detail.ocr_source ที่แอดมินตั้ง (ไม่เดาจากชื่อ)
  const billTargets = new Map<OcrSource, BillTarget>();
  for (const g of scopeGroups) {
    for (const d of g.details) {
      if (d.ocr_source) {
        billTargets.set(d.ocr_source, {
          scopedetail_id: d.scopedetail_id, detail_name: d.detail_name, unit: d.unit, source: d.ocr_source,
        });
      }
    }
  }
  const checkCtx = { period: ocrPeriod, items: bills.items, targets: billTargets };
  const checksOf = (it: PendingBill) => checkBill(it, checkCtx);
  const targetOf = (it: PendingBill) => {
    const src = it.billType ? ocrSourceOf(it.billType, it.fuelType) : null;
    return src ? billTargets.get(src) : undefined;
  };

  // [เพิ่ม] ยอดรวมจากบิลที่ยืนยันแล้ว แยกตามช่องกิจกรรม + ตัวเลือกเติมเดือนที่ขาด (รายปี)
  const billSummaries = summarize(bills.items, checksOf, billTargets);
  const [gaps, setGaps] = useState<GapState>({});
  // ยอดที่เติมลงฟอร์มล่าสุดของแต่ละช่อง (ไว้แสดงป้าย "จากบิล" และเตือนถ้ายังไม่ได้เติม)
  const [filled, setFilled] = useState<Record<string, { value: string; count: number }>>({});

  function setGap(scopedetailId: string, month: number, choice: GapChoice | null) {
    setGaps((prev) => {
      const forTarget = { ...(prev[scopedetailId] ?? {}) };
      if (choice) forTarget[month] = choice;
      else delete forTarget[month];
      return { ...prev, [scopedetailId]: forTarget };
    });
  }

  /* [เพิ่ม] เติมยอดจากบิลลงช่องกิจกรรม (ผู้ใช้แก้ต่อในฟอร์มได้) ถามก่อนเขียนทับค่าที่กรอกเอง */
  async function fillFromBills(ids?: string[]) {
    const targets = billSummaries.filter((s) => !ids || ids.includes(s.target.scopedetail_id));
    const next: Record<string, string> = {};
    const overwrite: string[] = [];
    for (const s of targets) {
      const v = fillValue(s, ocrPeriod, gaps);
      if (v === null) continue; // รายปีที่ยังขาดบางเดือน
      const id = s.target.scopedetail_id;
      const value = formatQty(v);
      const current = (values[id] ?? '').trim();
      if (current !== '' && current !== value && current !== filled[id]?.value) overwrite.push(s.target.detail_name ?? id);
      next[id] = value;
    }
    if (Object.keys(next).length === 0) return showAlert('ยังไม่มียอดที่เติมได้ (รายปีต้องจัดการเดือนที่ไม่มีบิลให้ครบ 12 เดือนก่อน)');
    if (overwrite.length > 0 &&
        !(await showConfirm(`ช่อง ${overwrite.join(', ')} มีค่าที่กรอกไว้แล้ว ต้องการแทนที่ด้วยยอดจากบิลหรือไม่?`, { confirmText: 'แทนที่' }))) return;

    setValues((prev) => ({ ...prev, ...next }));
    setFieldErrors((prev) => {
      const out = { ...prev };
      for (const id of Object.keys(next)) delete out[id];
      return out;
    });
    setFilled((prev) => {
      const out = { ...prev };
      for (const s of targets) {
        const id = s.target.scopedetail_id;
        if (next[id] !== undefined) out[id] = { value: next[id], count: s.bills.length };
      }
      return out;
    });
  }

  // [แก้ไข] เดิมเลือกได้แค่ปีปัจจุบัน +1 ย้อนหลัง 5 ปี -> ย้อนหลังได้ 30 ปี และพิมพ์ค้นหาปีได้ (YearPicker)
  const YEAR_MIN_BE = nowBE - 30;
  const YEAR_MAX_BE = nowBE + 1;

  function updatePeriod(type: PeriodType, m: number, y: number) {
    setPeriodType(type);
    setSelMonth(m);
    setSelYear(y);
    if (!nameTouched) setName(defaultName(type, derivePeriod(type, m, y)));
    if (fieldErrors.period) setFieldErrors((prev) => ({ ...prev, period: '' }));
  }

  function handleChange(scopedetailId: string, value: string) {
    setValues((prev) => ({ ...prev, [scopedetailId]: value }));
    // พิมพ์แก้แล้วล้าง error ของช่องนั้น
    if (fieldErrors[scopedetailId] || fieldErrors.form) setFieldErrors((prev) => ({ ...prev, [scopedetailId]: '', form: '' }));
  }

  // [เพิ่ม] schema ของทั้งหน้า: ชื่อกิจกรรม + ปริมาณทุกรายการ (key = scopedetail_id)
  function buildSchema(): formSchema<string> {
    const schema: formSchema<string> = {
      name: { rules: [required('ชื่อกิจกรรม'), notNumericOnly('ชื่อกิจกรรม'), maxLength('ชื่อกิจกรรม', NAME_MAX)] },
    };
    for (const group of scopeGroups) {
      for (const d of group.details) {
        schema[d.scopedetail_id] = {
          normalize: normalizeNumberString,
          rules: [isDecimal(d.detail_name ?? 'ปริมาณ', { allowNegative: false, maxDecimals: AMOUNT_MAX_DECIMALS })],
        };
      }
    }
    return schema;
  }

  // ---------- แนบไฟล์บิล (แยกตามหมวด) ----------
  const countOf = (type: string) => bills.items.filter((p) => p.slot === type).length;

  function handleFiles(type: BillType, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้

    // ต้องรู้เดือน/ปีของกิจกรรมก่อน เพื่อตรวจว่าบิลตรงกับช่วงเวลานี้
    // [แก้ไข] เดิมเด้ง alert -> แสดงกรอบแดง + ข้อความใต้ช่องเดือน/ปีแทน
    if (!periodMonth) {
      setFieldErrors((prev) => ({
        ...prev,
        period: periodType === 'year' ? 'กรุณาเลือกปีของกิจกรรมก่อนแนบบิล' : 'กรุณาเลือกเดือนและปีของกิจกรรมก่อนแนบบิล',
      }));
      return;
    }

    const accepted: File[] = [];
    const rejected: string[] = []; // [แก้ไข] รวมไฟล์ที่ใช้ไม่ได้ แจ้งครั้งเดียว (เดิมเด้ง alert ทีละไฟล์)
    const seen = new Set(
      bills.items.filter((p) => p.slot === type).map((p) => fileKey(p.file))
    );

    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        rejected.push(`"${f.name}" ไม่รองรับ (รองรับเฉพาะรูป JPG, PNG, WEBP)`);
        continue;
      }
      if (f.size === 0) {
        rejected.push(`"${f.name}" เป็นไฟล์ว่างเปล่า`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        rejected.push(`"${f.name}" ใหญ่เกิน 10 MB`);
        continue;
      }
      if (seen.has(fileKey(f))) {
        rejected.push(`"${f.name}" ถูกเลือกไว้แล้วในหมวดนี้`);
        continue;
      }
      seen.add(fileKey(f));
      accepted.push(f);
    }

    if (rejected.length > 0) showError(rejected.join('\n'), { title: 'ไฟล์บางไฟล์ใช้ไม่ได้' });
    if (accepted.length === 0) return;
    if (countOf(type) + accepted.length > maxPerType) {
      showError(`หมวด${billLabel(type)} แนบได้สูงสุด ${maxPerType} ไฟล์`);
      return;
    }
    bills.add(type, accepted); // อ่านบิลทีละไฟล์ แล้วแสดงผลให้ตรวจแก้
  }

  /* [ปิดใช้งาน] ระบบเก็บรูปบิลเดิม: เปิดดู/ลบบิลที่เคยเก็บ และอัปโหลดรูปบิลลง Storage 'bills' + ตาราง org_bill_file
   * ไม่ใช้แล้ว เพราะ OCR เป็นแค่ตัวช่วยกรอก ไม่เก็บรูปบิล (ข้อมูลเก่าใน Supabase ยังอยู่ ไม่ได้ลบ)
  async function openSaved(b: ExistingBill) {
    const { data, error } = await supabase.storage
      .from('bills')
      .createSignedUrl(b.file_path, 120); // ลิงก์ใช้ได้ 2 นาที
    if (error || !data) return showError('เปิดไฟล์ไม่สำเร็จ: ' + error?.message);
    window.open(data.signedUrl, '_blank');
  }

  async function deleteSaved(b: ExistingBill) {
    if (!confirm(`ลบไฟล์ "${b.original_name ?? 'บิล'}" ?`)) return;
    const { error: stErr } = await supabase.storage.from('bills').remove([b.file_path]);
    if (stErr) return showError('ลบไฟล์ไม่สำเร็จ: ' + stErr.message);
    const { error } = await supabase.from('org_bill_file').delete().eq('bill_id', b.bill_id);
    if (error) return showError('ลบข้อมูลไฟล์ไม่สำเร็จ: ' + error.message);
    setSaved((prev) => prev.filter((x) => x.bill_id !== b.bill_id));
  }

  // อัปโหลดบิลที่รอแนบ (หลังบันทึกรายการสำเร็จแล้ว) คืนจำนวนไฟล์ที่ไม่สำเร็จ
  async function uploadPending(logId: string): Promise<number> {
    let failed = 0;
    const uploaded: ExistingBill[] = [];

    for (const item of bills.items) {
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
          file_hash: item.fileHash ?? null,
          dedup_key: keyOf(item),
          bill_month: item.billMonth || null,
          quantity: Number(item.quantity),
          ocr_quantity: item.extracted?.quantity ?? null,
          user_edited: isEdited(item),
          fuel_type: item.fuelType || null,
          ocr_source: item.extracted?.source ?? null,
        })
        .select('bill_id, bill_type, file_path, original_name, file_size')
        .single();

      if (rowErr || !row) {
        // 23505 = ชน unique index ของ file_hash (ไฟล์เดียวกันเคยแนบแล้ว เช่น แนบพร้อมกันจากสองแท็บ)
        console.error('Insert bill row error:', rowErr);
        await supabase.storage.from('bills').remove([path]); // ไม่ให้เหลือไฟล์กำพร้า
        failed++;
        continue;
      }
      uploaded.push(row as ExistingBill);
    }

    setSaved((prev) => [...prev, ...uploaded]);
    bills.clear();
    return failed;
  }
  */

  /* [เพิ่ม] เหตุผลที่ยังกดคำนวณไม่ได้ / ต้องถามก่อน (แทน bills.blockReason เดิม)
   * บิลไม่บังคับแนบ: บิลที่ยังไม่ยืนยันจะไม่ถูกนำไปใช้ แต่ต้องรอให้อ่านเสร็จก่อน */
  function billConfirmMessages(): { block: string | null; ask: string[] } {
    if (bills.items.some((i) => i.status === 'reading')) return { block: 'กำลังอ่านบิล กรุณารอสักครู่', ask: [] };
    const ask: string[] = [];
    const unconfirmed = bills.items.filter((i) => !i.confirmed).length;
    if (unconfirmed > 0) ask.push(`มีบิล ${unconfirmed} ใบที่ยังไม่ได้ยืนยัน (จะไม่ถูกนำไปคำนวณ)`);
    const notFilled = billSummaries.filter((s) => {
      const v = fillValue(s, ocrPeriod, gaps);
      return v === null || (values[s.target.scopedetail_id] ?? '').trim() !== formatQty(v);
    });
    if (notFilled.length > 0) {
      ask.push(`ยอดจากบิลของ ${notFilled.map((s) => s.target.detail_name).join(', ')} ยังไม่ได้เติมลงฟอร์ม หรือถูกแก้ต่างจากยอดบิล`);
    }
    return { block: null, ask };
  }

  // ตรวจรายการที่ซ้อนกับช่วงเวลานี้ คืนข้อความเตือน หรือ null ถ้าไม่ซ้อน
  async function findOverlap(): Promise<string | null> {
    // [แก้ไข] โหมดแก้ไขที่ไม่ได้เปลี่ยนเดือน/ปี: เป็นการอัปเดตรายการเดิม ช่วงเวลาซ้อนเท่าเดิม ไม่ต้องถามซ้ำ
    if (isEdit && periodType === existingPeriodType && periodMonth === existingPeriod.slice(0, 10)) return null;

    const y = Number(periodMonth.slice(0, 4)); // ปี ค.ศ.
    let q = supabase
      .from('org_activity_list')
      .select('orgact_name, period_type, period_month')
      .eq('org_id', orgId)
      .gte('period_month', `${y}-01-01`)
      .lte('period_month', `${y}-12-31`);
    if (existingLogId) q = q.neq('orgactlist_id', existingLogId);
    const { data } = await q;

    const hit = (data ?? []).find((r: any) => {
      const rType: PeriodType = r.period_type === 'year' ? 'year' : 'month';
      if (periodType === 'year') return true; // รายปี: มีรายการใดในปีนั้นก็ซ้อน
      return rType === 'year' || r.period_month === periodMonth; // รายเดือน: ซ้ำเดือน หรือมีรายปีครอบอยู่
    }) as any;
    if (!hit) return null;

    const hitType: PeriodType = hit.period_type === 'year' ? 'year' : 'month';
    const hitLabel = periodLabel(hitType, hit.period_month);
    // [แก้ไข] โหมดแก้ไข: บอกให้ชัดว่าเป็นการอัปเดตรายการนี้ ไม่ใช่การบันทึกรายการใหม่เพิ่ม
    if (isEdit) {
      return `ช่วงเวลาที่แก้เป็น ${periodLabel(periodType, periodMonth)} ซ้อนกับรายการ "${hit.orgact_name}" (${hitLabel}) ที่มีอยู่แล้ว
` +
        'ยอดรวมของทั้ง 2 รายการอาจนับซ้ำ ต้องการอัปเดตรายการนี้ต่อหรือไม่?';
    }
    return periodType === 'year'
      ? `ปี ${yearBEOf(periodMonth)} มีรายการ "${hit.orgact_name}" (${hitLabel}) อยู่แล้ว\nการบันทึกรายปีเพิ่มอาจทำให้ยอดรวมนับซ้ำ ต้องการบันทึกต่อหรือไม่?`
      : hitType === 'year'
      ? `มีรายการรายปี "${hit.orgact_name}" ที่ครอบคลุมช่วงนี้อยู่แล้ว\nการบันทึกรายเดือนเพิ่มอาจทำให้ยอดรวมนับซ้ำ ต้องการบันทึกต่อหรือไม่?`
      : `${periodLabel('month', periodMonth)} มีรายการ "${hit.orgact_name}" อยู่แล้ว\nต้องการบันทึกรายการนี้เพิ่มหรือไม่?`;
  }

  /* [เพิ่ม] บันทึกข้อมูลสำนักงานที่พักไว้จากขั้นที่ 1 ลง org_office_info (ผูกด้วย orgactlist_id)
   * - ไม่มีค่าที่พักไว้ (เข้าขั้นที่ 2 ตรงๆ หรือกดข้าม) -> ไม่แตะข้อมูลสำนักงานเดิม
   * - รายการที่แก้ไข: ลบชุดเดิมของรายการนั้นแล้วใส่ชุดใหม่
   * ล้มเหลวไม่ยกเลิกรายการที่บันทึกแล้ว: แจ้งให้กดแก้ไขรายการแล้วกรอกข้อมูลสำนักงานใหม่ */
  async function saveOfficeInfo(logId: string) {
    const scope = draftScope(existingLogId);
    const draft = readOfficeDraft(orgId, scope);
    if (!draft) return;

    const rows = Object.entries(draft)
      .filter(([, amount]) => amount !== '')
      .map(([info_id, amount]) => ({ orgactlist_id: logId, info_id, amount })); // [แก้ไข] ไม่มี org_id แล้ว

    let error: { message: string } | null = null;
    if (isEdit) {
      ({ error } = await supabase
        .from('org_office_info')
        .delete()
        .eq('orgactlist_id', logId));
    }
    if (!error && rows.length > 0) {
      ({ error } = await supabase.from('org_office_info').insert(rows));
    }
    if (error) {
      await showError('บันทึกรายการเรียบร้อย แต่บันทึกข้อมูลสำนักงานไม่สำเร็จ: ' + error.message +
        '\n(กดแก้ไขรายการเพื่อกรอกข้อมูลสำนักงานใหม่ได้)');
      return;
    }
    clearOfficeDraft(scope);
  }

  // ---------- คำนวณและบันทึก ----------
  async function handleCalculate() {
    // [แก้ไข] normalize + validate ชื่อและปริมาณทุกช่องพร้อมกัน แสดง error ใต้ช่อง
    const result = validateForm({ ...values, name }, buildSchema());
    const errs: Record<string, string> = result.ok ? {} : { ...(result.errors as Record<string, string>) };

    // [เพิ่ม] ตรวจความสัมพันธ์: รายการที่กรอก > 0 ต้องมีค่า EF ผูกอยู่
    for (const group of scopeGroups) {
      for (const d of group.details) {
        const qty = normalizeToArabicNumber(result.clean[d.scopedetail_id]);
        if (!errs[d.scopedetail_id] && qty && qty > 0 && d.emission_factor?.ef_value == null) {
          errs[d.scopedetail_id] = 'รายการนี้ยังไม่มีค่า EF ในระบบ กรุณาติดต่อผู้ดูแลระบบ';
        }
      }
    }

    // [แก้ไข] เดิมเด้ง alert "กรุณาตรวจสอบข้อมูล..." และ "กรุณาเลือกเดือนและปี"
    //   ตอนนี้แสดงแค่กรอบแดง + ข้อความใต้ช่อง (เดือน/ปีใช้ key 'period') ไม่มี popup
    if (!periodMonth) errs.period = periodType === 'year' ? 'กรุณาเลือกปี' : 'กรุณาเลือกเดือนและปี';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const cleanName = result.clean.name; // ชื่อที่ normalize แล้ว (ยุบช่องว่าง/ตัดหัวท้าย)

    // [แก้ไข] บิลต้องอ่านเสร็จ ส่วนบิลที่ยังไม่ยืนยัน/ยอดที่ยังไม่เติมลงฟอร์ม ให้ผู้ใช้ตัดสินใจเอง
    const billState = billConfirmMessages();
    if (billState.block) return showAlert(billState.block, { tone: 'warning' });
    if (billState.ask.length > 0 && !await showConfirm(`${billState.ask.join('\n')}\n\nต้องการคำนวณด้วยค่าที่อยู่ในฟอร์มตอนนี้หรือไม่?`, { confirmText: 'คำนวณต่อ' })) return;

    setLoading(true);

    const rows: {
      scopedetail_id: string;
      amount: number;
      unit: string | null;
      ghg_emission: number; // tCO2e
    }[] = [];

    for (const group of scopeGroups) {
      for (const detail of group.details) {
        // [แก้ไข] เดิม parseFloat(ค่าดิบ) -> ใช้ค่าที่ normalize + validate แล้ว
        const qty = normalizeToArabicNumber(result.clean[detail.scopedetail_id]) ?? 0;
        if (qty <= 0) continue; // ว่าง หรือ 0 = ไม่ได้ใช้รายการนี้
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
      // [แก้ไข] เดิมเด้ง alert -> แสดงข้อความสีแดงเหนือปุ่มคำนวณ
      setFieldErrors((prev) => ({ ...prev, form: 'กรุณากรอกปริมาณอย่างน้อย 1 รายการ' }));
      return;
    }

    const overlap = await findOverlap();
    if (overlap && !(await showConfirm(overlap, { title: 'ช่วงเวลาซ้อนกับรายการอื่น', confirmText: isEdit ? 'อัปเดตต่อ' : 'บันทึกต่อ' }))) {
      setLoading(false);
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
        return showError('อ่านรายละเอียดเดิมไม่สำเร็จ: ' + oldError.message);
      }

      // เพิ่มชุดใหม่ก่อน ถ้าล้มเหลวข้อมูลเดิมยังอยู่ครบ
      const { error: insError } = await supabase
        .from('org_activity_detail')
        .insert(rows.map((r) => ({ orgactlist_id: logId, ...r })));
      if (insError) {
        setLoading(false);
        return showError('บันทึกรายละเอียดไม่สำเร็จ: ' + insError.message);
      }

      const oldIds = (oldRows ?? []).map((r: any) => r.orgactdetail_id as string);
      if (oldIds.length > 0) {
        const { error: delError } = await supabase
          .from('org_activity_detail')
          .delete()
          .in('orgactdetail_id', oldIds);
        if (delError) {
          setLoading(false);
          return showError('ลบรายละเอียดเดิมไม่สำเร็จ: ' + delError.message);
        }
      }

      const { error: updError } = await supabase
        .from('org_activity_list')
        .update({
          orgact_name: cleanName,
          period_type: periodType,
          period_month: periodMonth,
          total_ghg_emission: total,
          updated_at: new Date().toISOString(),
        })
        .eq('orgactlist_id', logId)
        .eq('org_id', orgId);
      if (updError) {
        setLoading(false);
        return showError('อัปเดตยอดรวมไม่สำเร็จ: ' + updError.message);
      }
    } else {
      // ===== โหมดสร้างใหม่ =====
      const { data: head, error: headError } = await supabase
        .from('org_activity_list')
        .insert({
          org_id: orgId,
          orgact_name: cleanName,
          period_type: periodType,
          period_month: periodMonth,
          total_ghg_emission: total,
          unit: 'tCO2e',
        })
        .select('orgactlist_id')
        .single();
      if (headError || !head) {
        setLoading(false);
        return showError('บันทึกไม่สำเร็จ: ' + headError?.message);
      }
      logId = head.orgactlist_id as string;

      const { error: detailError } = await supabase
        .from('org_activity_detail')
        .insert(rows.map((r) => ({ orgactlist_id: logId, ...r })));
      if (detailError) {
        await supabase.from('org_activity_list').delete().eq('orgactlist_id', logId);
        setLoading(false);
        return showError('บันทึกรายละเอียดไม่สำเร็จ: ' + detailError.message);
      }
    }

    // [เพิ่ม] บันทึกข้อมูลสำนักงานที่กรอกในขั้นที่ 1 ผูกกับรายการนี้ (ทั้งรายการใหม่และที่แก้ไข)
    await saveOfficeInfo(logId);

    // [ปิดใช้งาน] เดิมอัปโหลดรูปบิลลง Storage หลังบันทึกรายการ -> ตอนนี้ไม่เก็บรูปบิลแล้ว
    // if (bills.items.length > 0) { const failed = await uploadPending(logId); ... }

    setLoading(false);
    // ล้างบิลที่แนบ (อยู่แค่ใน state) หลังบันทึกสำเร็จ
    bills.clear();
    setGaps({});
    setFilled({});
    if (!isEdit) setValues({});
    setDone({ id: logId, total });
  }

  // การ์ดแนบบิลของแต่ละหมวด
  // [แก้ไข] เลิกแสดงบิลที่เคยเก็บใน org_bill_file และส่งช่องกิจกรรมที่จะเติม (target) ให้ BillRow
  function renderBillCategory(type: BillType, label: string, hint: string) {
    const pendingOfType = bills.items.filter((p) => p.slot === type);
    const used = pendingOfType.length;
    const full = used >= maxPerType;

    return (
      <div key={type} className="overflow-hidden rounded-[25px] border border-[#BDC9C1] bg-white">
        <div className="flex items-center justify-between border-b border-[#BDC9C1] bg-[#F2F4F6] px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#6FB898]" />
            <h3 className="text-base text-[#191C1E]">{label}</h3>
          </div>
          <span className="text-xs text-[#6B7280]">
            {used}/{maxPerType} ไฟล์
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={`flex h-11 items-center rounded-[20px] px-5 text-sm font-semibold text-white ${
                full ? 'cursor-not-allowed bg-[#94A3B8]' : 'cursor-pointer bg-[#32885F]'
              }`}
            >
              เลือกรูปบิล
              <input
                type="file"
                multiple
                disabled={full}
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e) => handleFiles(type, e)}
                className="hidden"
              />
            </label>
            <span className="text-xs text-[#6B7280]">{hint}</span>
          </div>

          {used === 0 && <p className="text-xs text-[#94A3B8]">ยังไม่มีบิลในหมวดนี้</p>}

          {/* บิลที่แนบ: OCR อ่านแล้วให้ตรวจแก้ แล้วกดยืนยัน */}
          {pendingOfType.length > 0 && (
            <ul className="space-y-2">
              {pendingOfType.map((p) => (
                <BillRow
                  key={p.uid}
                  item={p}
                  checks={checksOf(p)}
                  period={ocrPeriod}
                  target={targetOf(p)}
                  onEdit={(patch) => bills.edit(p.uid, patch)}
                  onRemove={() => bills.remove(p.uid)}
                  trashIcon={<TrashIcon />}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // [เพิ่ม] การ์ดสรุปยอดจากบิลที่ยืนยันแล้ว + ปุ่มเติมลงฟอร์ม
  function renderBillSummary() {
    if (billSummaries.length === 0) return null;
    return (
      <div className="overflow-hidden rounded-[25px] border border-[#32885F] bg-white">
        <div className="flex items-center justify-between border-b border-[#BDC9C1] bg-[#ECFDF5] px-4 py-2">
          <h3 className="text-base text-[#191C1E]">
            สรุปยอดจากบิลที่ยืนยันแล้ว ({periodType === 'year' ? `ปี ${yearBEOf(ocrPeriod.month)}` : periodLabel('month', ocrPeriod.month)})
          </h3>
          <button
            type="button"
            onClick={() => fillFromBills()}
            className="rounded-full bg-[#32885F] px-4 py-1.5 text-xs font-semibold text-white"
          >
            เติมทั้งหมดลงฟอร์ม
          </button>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          {billSummaries.map((s) => {
            const id = s.target.scopedetail_id;
            const v = fillValue(s, ocrPeriod, gaps);
            return (
              <div key={id} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#191C1E]">{s.target.detail_name}</p>
                    <p className="text-xs text-[#6B7280]">
                      จากบิล {s.bills.length} ใบ
                      {periodType === 'month' && ' (บิลหลายใบในเดือนเดียวกันรวมยอดให้แล้ว)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold">
                      {v === null ? 'ยังขาดบางเดือน' : `${v.toLocaleString('th-TH', { maximumFractionDigits: 4 })} ${s.target.unit ?? ''}`}
                    </span>
                    <button
                      type="button"
                      disabled={v === null}
                      onClick={() => fillFromBills([id])}
                      className="rounded-full border border-[#32885F] px-3 py-1 text-xs font-semibold text-[#32885F] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                    >
                      เติมลงช่องนี้
                    </button>
                  </div>
                </div>
                {periodType === 'year' && (
                  <YearlySummary
                    summary={s}
                    gaps={gaps[id] ?? {}}
                    onGapChange={(month, choice) => setGap(id, month, choice)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
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
          <Link href={backHref} className="font-semibold underline">
            กรอกข้อมูลสำนักงาน
          </Link>
        </div>
      )}

      {/* ข้อมูลกิจกรรม: ชื่อก่อน แล้วค่อยเลือกช่วงเวลา */}
      <div className="mb-6 overflow-hidden rounded-[25px] border border-[#BDC9C1] bg-white">
        <div className="flex items-center gap-2 border-b border-[#BDC9C1] bg-[#F2F4F6] px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-[#6FB898]" />
          <h2 className="text-base text-[#191C1E]">ข้อมูลกิจกรรม</h2>
        </div>

        <div className="space-y-5 p-4">
          {/* 1) ชื่อกิจกรรม */}
          <div className="space-y-1">
            <label className="block text-xs tracking-wide text-[#3E4943]">
              ชื่อกิจกรรม <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="เช่น คาร์บอนฟุตพรินต์ มี.ค.69"
              className={`h-11 w-full rounded-[20px] border bg-[#F7F9FB] px-[18px] text-base text-[#191C1E] outline-none ${
                fieldErrors.name ? 'border-red-500' : 'border-[#BDC9C1]'
              }`}
            />
            {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
            {nameTouched && periodMonth && name.trim() !== defaultName(periodType, periodMonth) && (
              <button
                type="button"
                onClick={() => {
                  setName(defaultName(periodType, periodMonth));
                  setNameTouched(false);
                }}
                className="text-xs text-[#32885F] hover:underline"
              >
                ใช้ชื่อที่ระบบแนะนำ: {defaultName(periodType, periodMonth)}
              </button>
            )}
          </div>

          {/* 2) รูปแบบการคำนวณ */}
          <div className="space-y-1">
            <label className="block text-xs tracking-wide text-[#3E4943]">
              คำนวณแบบ <span className="text-red-500">*</span>
            </label>
            <div className="inline-flex rounded-[20px] border border-[#BDC9C1] bg-[#F7F9FB] p-1">
              {(
                [
                  { v: 'month', label: 'รายเดือน' },
                  { v: 'year', label: 'รายปี' },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => {
                    if (o.v === periodType) return;
                    // สลับแล้วเก็บปีไว้ ส่วนเดือนให้เลือกใหม่เมื่อกลับมารายเดือน
                    updatePeriod(o.v, 0, selYear);
                  }}
                  className={`h-9 rounded-[16px] px-6 text-sm ${
                    periodType === o.v
                      ? 'bg-[#32885F] font-semibold text-white'
                      : 'text-[#64748B]'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3) เดือน/ปี หรือปี */}
          <div className="space-y-1">
            <label className="block text-xs tracking-wide text-[#3E4943]">
              {periodType === 'year' ? 'ปี (พ.ศ.)' : 'เดือน/ปีที่บันทึก'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {periodType === 'month' && (
                <select
                  value={selMonth || ''}
                  onChange={(e) => updatePeriod('month', Number(e.target.value), selYear || nowBE)}
                  className={`h-11 w-48 rounded-[20px] border bg-[#F7F9FB] px-4 text-sm ${
                    fieldErrors.period && !selMonth ? 'border-red-500' : 'border-[#BDC9C1]'
                  }`}
                >
                  <option value="" disabled>
                    เดือน
                  </option>
                  {TH_MONTHS_FULL.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
              {/* [แก้ไข] เดิมเป็น <select> -> ช่องเลือกปีที่พิมพ์ค้นหาได้ */}
              <YearPicker
                value={selYear}
                onChange={(y) => updatePeriod(periodType, selMonth, y)}
                min={YEAR_MIN_BE}
                max={YEAR_MAX_BE}
                hasError={!!fieldErrors.period && !selYear}
                className="w-40"
              />
            </div>
            {fieldErrors.period && <p className="text-xs text-red-600">{fieldErrors.period}</p>}
            {periodType === 'year' && (
              <p className="text-xs text-[#6B7280]">
                รายปี: กรอกปริมาณรวมตลอดทั้งปีในแต่ละรายการ (เช่น ผลรวมของบิลไฟ 12 เดือน)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* แนบบิล แยกตามหมวด */}
      <div className="mb-6">
        <div className="mb-3">
          <h2 className="text-base font-medium text-[#191C1E]">อ่านบิลเพื่อช่วยกรอกข้อมูล (ไม่บังคับ)</h2>
          {/* [แก้ไข] ข้อความใหม่: OCR ช่วยกรอกเท่านั้น ไม่เก็บรูปบิล */}
          <p className="text-xs text-[#6B7280]">
            แนบรูปบิลแยกตามประเภท (JPG, PNG, WEBP ไม่เกิน 10 MB ต่อไฟล์ สูงสุด {maxPerType} ไฟล์ต่อหมวด)
            ระบบจะอ่านเดือน ปริมาณ และเลขที่บิลให้ ตรวจแก้แล้วกด &quot;ยืนยันข้อมูล&quot;
            จากนั้นกด &quot;เติมลงฟอร์ม&quot; ระบบไม่เก็บรูปบิลไว้
            {periodType === 'year' && ' (รายปี: แนบบิลของแต่ละเดือนในปีนั้น เดือนที่ไม่มีบิลกรอกเองหรือใช้ค่าเดือนก่อนหน้าได้)'}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {BILL_CATEGORIES.map((c) => renderBillCategory(c.value, c.label, c.hint))}
          {renderBillSummary()}
        </div>
      </div>

      {/* หัวข้อคั่นก่อนกรอกข้อมูลแต่ละขอบเขต */}
      <div className="mb-4 mt-10 border-t border-[#E2E8F0] pt-8">
        <h2 className="text-base font-medium text-[#191C1E]">
          กรอกปริมาณกิจกรรมแต่ละขอบเขต (Scope 1, 2 และ 3)
        </h2>
        <p className="text-xs text-[#6B7280]">
          กรอกปริมาณที่ใช้ในช่วงเวลาที่เลือกไว้ด้านบน ช่องที่ไม่มีข้อมูลเว้นว่างไว้ได้
          ระบบจะคำนวณเฉพาะรายการที่กรอก
        </p>
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
                  <div
                    className={`flex h-11 items-center justify-between rounded-[20px] border bg-[#F7F9FB] px-[18px] ${
                      fieldErrors[detail.scopedetail_id] ? 'border-red-500' : 'border-[#BDC9C1]'
                    }`}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={values[detail.scopedetail_id] ?? ''}
                      onChange={(e) => handleChange(detail.scopedetail_id, e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent text-base text-[#191C1E] outline-none"
                    />
                    <span className="whitespace-nowrap pl-2 text-base text-[#6B7280]">
                      {detail.unit}
                    </span>
                  </div>
                  {fieldErrors[detail.scopedetail_id] && (
                    <p className="text-xs text-red-600">{fieldErrors[detail.scopedetail_id]}</p>
                  )}
                  {/* [เพิ่ม] ป้ายบอกว่าค่านี้เติมจากบิล (หายเมื่อผู้ใช้แก้ค่าเอง) */}
                  {filled[detail.scopedetail_id] &&
                    (values[detail.scopedetail_id] ?? '').trim() === filled[detail.scopedetail_id].value && (
                      <p className="text-xs text-emerald-700">✓ เติมจากบิล {filled[detail.scopedetail_id].count} ใบ</p>
                    )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* [เพิ่ม] error ระดับฟอร์ม (เช่น ยังไม่กรอกปริมาณเลย) แสดงเหนือปุ่ม แทน popup */}
      {fieldErrors.form && <p className="mt-6 text-sm text-red-600">{fieldErrors.form}</p>}
      <div className="mt-8 flex items-center gap-4">
        <Link
          // [แก้ไข] กลับไปขั้นที่ 1 พร้อม ?resume=1 เพื่อให้เห็นค่าข้อมูลสำนักงานที่กรอกไว้
          href={backHref}
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