// lib/bills/checks.ts
/* [ปรับปรุง] ตรวจบิล 1 ใบหลัง OCR อ่านเสร็จ (คำนวณใหม่ทุกครั้งที่ผู้ใช้แก้ค่า หรือเปลี่ยนเดือน/ปีของกิจกรรม)
 *   fail = ยืนยันไม่ได้ ต้องแก้หรือเอาบิลออก
 *   warn = ยืนยันได้ แต่ต้องติ๊ก "รับทราบ" ก่อน
 * เดิมตรวจซ้ำกับตาราง org_bill_file -> ตอนนี้ตรวจซ้ำกับบิลอื่นที่แนบในหน้านี้ (ไม่เก็บบิลลง DB แล้ว) */
import { normalizeForCompare, normalizeNumberString } from '@/lib/normalization';
import { isDecimal } from '@/lib/validation';
import { monthLabel } from './dates';
import { unitFactor } from './units';
import {
  BILL_TYPE_LABEL, BILL_UNIT, ocrSourceOf,
  type ActivityPeriod, type BillType, type Check, type OcrSource,
} from './types';
import type { PendingBill } from './useBillOcr';

// ช่องกิจกรรมที่รับข้อมูลจากบิล (activity_detail ที่แอดมินตั้ง ocr_source ไว้)
export type BillTarget = {
  scopedetail_id: string;
  detail_name: string | null;
  unit: string | null;
  source: OcrSource;
};

export type CheckContext = {
  period: ActivityPeriod;
  items: PendingBill[];                    // บิลทั้งหมดในหน้า (ใช้หาบิลซ้ำ)
  targets: Map<OcrSource, BillTarget>;
};

// เพดานเตือนปริมาณสูงผิดปกติต่อ 1 บิล (หน่วยของบิล: kWh / ลิตร) ปรับตามขนาดองค์กรได้
const HIGH: Record<BillType, number> = { electricity: 100000, water: 5000000, fuel: 5000 };

// ปริมาณในบิล: ไม่ติดลบ มากกว่า 0 ทศนิยมไม่เกิน 4 หลัก (ใช้กฎเดียวกับช่องปริมาณในฟอร์ม)
const qtyRule = isDecimal('ปริมาณ', { allowNegative: false, allowZero: false, maxDecimals: 4 });

// เลขบิลสำหรับเทียบซ้ำ: ไม่สนช่องว่าง ขีด และตัวพิมพ์เล็ก/ใหญ่
const billKey = (s: string) => normalizeForCompare(s).replace(/[-/]/g, '');

export function checkBill(it: PendingBill, ctx: CheckContext): Check[] {
  if (it.status !== 'ready') return [];
  const out: Check[] = [];
  const add = (level: Check['level'], code: string, message: string) => out.push({ level, code, message });

  // 1) ประเภทบิลตรงกับหมวดที่แนบไหม (เช่น แนบในช่องบิลไฟ แต่เป็นบิลน้ำ)
  if (!it.billType) {
    add('fail', 'NO_TYPE', 'ระบุประเภทบิลไม่ได้ กรุณาเลือกประเภทบิล');
  } else if (it.billType !== it.slot) {
    add('fail', 'TYPE_MISMATCH',
      `แนบไว้ในหมวด${BILL_TYPE_LABEL[it.slot]} แต่บิลนี้เป็น${BILL_TYPE_LABEL[it.billType]} กรุณาเอาออกแล้วแนบในหมวดที่ถูกต้อง`);
  }

  // 2) เดือน/ปีของบิลตรงกับกิจกรรมไหม
  if (!it.month || !it.year) {
    add('fail', 'NO_MONTH', 'อ่านเดือน/ปีของบิลไม่ได้ กรุณาเลือกเอง');
  } else {
    const billMonth = `${it.year}-${String(it.month).padStart(2, '0')}-01`;
    const { period } = ctx;
    const ok = period.type === 'month'
      ? billMonth === period.month
      : billMonth.slice(0, 4) === period.month.slice(0, 4);
    if (!ok) {
      const want = period.type === 'month' ? monthLabel(period.month) : `ปี ${+period.month.slice(0, 4) + 543}`;
      add('fail', 'MONTH_MISMATCH', `บิลนี้เป็นของ ${monthLabel(billMonth)} แต่กิจกรรมที่บันทึกคือ ${want}`);
    }
  }

  // 3) ปริมาณ
  const qtyResult = qtyRule(normalizeNumberString(it.quantity));
  if (it.quantity.trim() === '') add('fail', 'NO_QTY', 'อ่านปริมาณไม่ได้ กรุณากรอกเอง');
  else if (!qtyResult.ok) add('fail', 'QTY_INVALID', qtyResult.message);
  else if (it.billType && Number(normalizeNumberString(it.quantity)) > HIGH[it.billType]) {
    add('warn', 'QTY_HIGH', 'ปริมาณสูงผิดปกติ ตรวจจุดทศนิยมและหน่วยอีกครั้ง');
  }

  // 4) ชนิดน้ำมัน (บิลน้ำมันต้องรู้ชนิด เพราะแต่ละชนิดเติมคนละช่อง)
  if (it.billType === 'fuel' && !it.fuelType) add('fail', 'NO_FUEL', 'กรุณาเลือกชนิดน้ำมัน');

  // 5) หน่วยที่ OCR อ่านได้ต้องตรงกับประเภทบิล (ไฟ = kWh, น้ำ/น้ำมัน = L)
  if (it.billType && it.ocr?.unit && it.ocr.unit !== BILL_UNIT[it.billType]) {
    add('warn', 'OCR_UNIT', `ระบบอ่านหน่วยได้ "${it.ocr.unit}" แต่บิลประเภทนี้ควรเป็น ${BILL_UNIT[it.billType]} ตรวจปริมาณอีกครั้ง`);
  }

  // 6) มีช่องกิจกรรมรับข้อมูลจากบิลนี้ไหม และหน่วยแปลงกันได้ไหม (ตรวจความสัมพันธ์กับ activity_detail)
  const source = it.billType ? ocrSourceOf(it.billType, it.fuelType) : null;
  if (source) {
    const target = ctx.targets.get(source);
    if (!target) {
      add('fail', 'NO_TARGET', 'ยังไม่มีรายการกิจกรรมที่รับข้อมูลจากบิลประเภทนี้ กรุณาติดต่อผู้ดูแลระบบ');
    } else if (unitFactor(BILL_UNIT[it.billType as BillType], target.unit) === null) {
      add('fail', 'UNIT_MISMATCH',
        `หน่วยของบิล (${BILL_UNIT[it.billType as BillType]}) แปลงเป็นหน่วยของรายการ "${target.detail_name}" (${target.unit ?? '-'}) ไม่ได้ กรุณาติดต่อผู้ดูแลระบบ`);
    }
  }

  // 7) บิลซ้ำ: ไฟล์เดียวกัน หรือเลขที่บิลเดียวกัน กับบิลที่แนบไว้ก่อนหน้า (ใบหลังโดนธง ไม่ถูกนับ)
  const idx = ctx.items.findIndex((x) => x.uid === it.uid);
  const before = ctx.items.slice(0, idx).filter((x) => x.status === 'ready');
  const sameFile = it.fileHash && before.find((x) => x.fileHash === it.fileHash);
  const key = billKey(it.billNumber);
  const sameNo = key && before.find((x) => billKey(x.billNumber) === key);
  if (sameFile) add('fail', 'DUP_FILE', `ไฟล์นี้ซ้ำกับ ${sameFile.file.name} ที่แนบไว้แล้ว`);
  else if (sameNo) add('fail', 'DUP_BILL', `เลขที่บิลซ้ำกับ ${sameNo.file.name} ที่แนบไว้แล้ว (บิลใบเดียวกัน)`);
  else if (!key) add('warn', 'NO_BILL_NO', 'ไม่มีเลขที่บิล ระบบตรวจไม่ได้ว่าแนบซ้ำหรือไม่ กรุณาตรวจเอง');

  return out;
}

export const hasFail = (checks: Check[]) => checks.some((c) => c.level === 'fail');
export const hasWarn = (checks: Check[]) => checks.some((c) => c.level === 'warn');

/* ยืนยันได้เมื่อไม่มี fail และรับทราบ warn แล้ว */
export const canConfirm = (it: PendingBill, checks: Check[]) =>
  it.status === 'ready' && !hasFail(checks) && (!hasWarn(checks) || it.ack);

/* บิลที่นำไปรวมยอดได้: ยืนยันแล้ว และยังผ่านการตรวจ (ถ้าเปลี่ยนเดือนกิจกรรมทีหลังจนไม่ผ่าน จะไม่ถูกนับ) */
export const isUsable = (it: PendingBill, checks: Check[]) => it.confirmed && canConfirm(it, checks);
