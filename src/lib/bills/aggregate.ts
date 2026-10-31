// lib/bills/aggregate.ts
/* [เพิ่มใหม่] รวมยอดจากบิลที่ "ยืนยันแล้ว" แยกตามช่องกิจกรรม แล้วแปลงเป็นหน่วยของช่องนั้น
 * กติกากันนับซ้ำ:
 *   - บิลซ้ำ (ไฟล์เดียวกัน/เลขบิลเดียวกัน) ถูกตัดตั้งแต่ checks.ts จึงไม่มาถึงที่นี่
 *   - รายเดือน: บิลทุกใบของเดือนนั้นรวมกัน (เช่น หลายมิเตอร์ หรือเติมน้ำมันหลายครั้ง)
 *   - รายปี  : แยกยอดเป็น 12 เดือน เดือนที่ไม่มีบิลให้ผู้ใช้เลือก "กรอกเอง" หรือ "ใช้ค่าเดือนก่อนหน้า"
 *              ต้องครบ 12 เดือนก่อนจึงเติมยอดรวมลงฟอร์มได้ */
import { normalizeNumberString, normalizeToArabicNumber } from '@/lib/normalization';
import { isDecimal } from '@/lib/validation';
import { round4, unitFactor } from './units';
import { BILL_UNIT, ocrSourceOf, type ActivityPeriod, type BillType, type Check } from './types';
import { isUsable, type BillTarget } from './checks';
import type { PendingBill } from './useBillOcr';

export type TargetSummary = {
  target: BillTarget;
  bills: PendingBill[];            // บิลที่ยืนยันแล้วของช่องนี้
  monthTotals: (number | null)[];  // index 0-11 = ม.ค.-ธ.ค. ยอดจากบิล (หน่วยของช่องกิจกรรม) null = ไม่มีบิล
  billTotal: number;               // ผลรวมจากบิลทั้งหมด (หน่วยของช่องกิจกรรม)
};

// ปริมาณของบิล 1 ใบ แปลงเป็นหน่วยของช่องกิจกรรมแล้ว
function billAmount(it: PendingBill, target: BillTarget): number {
  const qty = normalizeToArabicNumber(normalizeNumberString(it.quantity)) ?? 0;
  const factor = unitFactor(BILL_UNIT[it.billType as BillType], target.unit) ?? 0;
  return qty * factor;
}

/* สรุปยอดของทุกช่องที่มีบิลยืนยันแล้ว */
export function summarize(
  items: PendingBill[],
  checksOf: (it: PendingBill) => Check[],
  targets: Map<string, BillTarget>,
): TargetSummary[] {
  const map = new Map<string, TargetSummary>();
  for (const it of items) {
    if (!it.billType || !isUsable(it, checksOf(it))) continue;
    const source = ocrSourceOf(it.billType, it.fuelType);
    const target = source ? targets.get(source) : undefined;
    if (!target) continue;

    let s = map.get(target.scopedetail_id);
    if (!s) {
      s = { target, bills: [], monthTotals: Array(12).fill(null), billTotal: 0 };
      map.set(target.scopedetail_id, s);
    }
    const amount = billAmount(it, target);
    s.bills.push(it);
    s.monthTotals[it.month - 1] = round4((s.monthTotals[it.month - 1] ?? 0) + amount);
    s.billTotal = round4(s.billTotal + amount);
  }
  return [...map.values()];
}

/* ===================== รายปี: เติมเดือนที่ขาด ===================== */
export type GapChoice = { mode: 'manual'; value: string } | { mode: 'prev' };
// key ชั้นนอก = scopedetail_id, ชั้นใน = เดือน 1-12
export type GapState = Record<string, Record<number, GapChoice>>;

const manualRule = isDecimal('ปริมาณ', { allowNegative: false, maxDecimals: 4 });

export type YearResolution = {
  values: (number | null)[];                                   // ยอดแต่ละเดือนหลังเติมช่องว่าง
  source: ('bill' | 'manual' | 'prev' | null)[];
  errors: (string | null)[];                                   // error ของช่องกรอกเอง
  missing: number[];                                           // เดือน (1-12) ที่ยังไม่มีค่า
  total: number;
};

export function resolveYear(s: TargetSummary, gaps: Record<number, GapChoice> = {}): YearResolution {
  const values: (number | null)[] = [];
  const source: YearResolution['source'] = [];
  const errors: (string | null)[] = [];
  for (let i = 0; i < 12; i++) {
    errors.push(null);
    if (s.monthTotals[i] !== null) {
      values.push(s.monthTotals[i]);
      source.push('bill');
      continue;
    }
    const g = gaps[i + 1];
    if (g?.mode === 'prev') {
      // ใช้ค่าเดือนก่อนหน้า (ถ้าเดือนก่อนหน้ายังไม่มีค่า หรือเป็น ม.ค. ถือว่ายังขาด)
      const prev = i > 0 ? values[i - 1] : null;
      values.push(prev);
      source.push(prev === null ? null : 'prev');
      if (prev === null) errors[i] = i === 0 ? 'มกราคมไม่มีเดือนก่อนหน้า กรุณากรอกเอง' : 'เดือนก่อนหน้ายังไม่มีค่า';
    } else if (g?.mode === 'manual' && g.value.trim() !== '') {
      const v = normalizeNumberString(g.value);
      const r = manualRule(v);
      if (r.ok) {
        values.push(normalizeToArabicNumber(v));
        source.push('manual');
      } else {
        values.push(null);
        source.push(null);
        errors[i] = r.message;
      }
    } else {
      values.push(null);
      source.push(null);
    }
  }
  const missing = values.flatMap((v, i) => (v === null ? [i + 1] : []));
  const total = round4(values.reduce<number>((sum, v) => sum + (v ?? 0), 0));
  return { values, source, errors, missing, total };
}

/* ยอดที่จะเติมลงฟอร์ม (null = ยังเติมไม่ได้ เพราะรายปีขาดบางเดือน) */
export function fillValue(s: TargetSummary, period: ActivityPeriod, gaps: GapState): number | null {
  if (period.type === 'month') return s.billTotal;
  const r = resolveYear(s, gaps[s.target.scopedetail_id]);
  return r.missing.length === 0 ? r.total : null;
}

/* ตัวเลขสำหรับใส่ในช่องฟอร์ม เช่น 41 หรือ 21.46 */
export const formatQty = (n: number) => String(round4(n));
