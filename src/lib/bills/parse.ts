// lib/bills/parse.ts
import type { BillType, Extracted, FuelType } from './types';
import { MONTH_RE, findDates, iso, majorityMonth, monthNo, toCE } from './dates';

const NUM = /([\d,]+(?:\.\d+)?)/.source;
const toNum = (s?: string) => {
  if (!s) return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ลองทีละกฎ ใช้ตัวแรกที่เจอเลขมากกว่า 0
const QTY_RULES: Record<BillType, RegExp[]> = {
  electricity: [
    new RegExp(/(?:หน่วยที่ใช้|จำนวนหน่วย|ไฟฟ้าที่ใช้)\D{0,25}/.source + NUM),
    new RegExp(NUM + /\s*(?:kwh|กิโลวัตต์ชั่วโมง)/.source, 'i'),
  ],
  water: [
    new RegExp(/(?:จำนวนน้ำที่ใช้|ปริมาณน้ำ|น้ำที่ใช้|หน่วยที่ใช้)\D{0,25}/.source + NUM),
    new RegExp(NUM + /\s*(?:ลบ\.?ม\.?|ลูกบาศก์เมตร|m3|m³)/.source, 'i'),
  ],
  fuel: [
    new RegExp(NUM + /\s*(?:ลิตร|liters?|litres?)/.source, 'i'),
    new RegExp(/(?:ปริมาณ|จำนวนลิตร)\D{0,15}/.source + NUM),
  ],
};

const ACCOUNT = new RegExp(
  /(?:เลขที่บัญชีสัญญา|หมายเลขผู้ใช้ไฟ|รหัสผู้ใช้ไฟ|เลขที่ผู้ใช้ไฟ|รหัสผู้ใช้น้ำ|หมายเลขผู้ใช้น้ำ|เลขที่ผู้ใช้น้ำ|ทะเบียนผู้ใช้น้ำ|เลขที่บัญชี)\D{0,12}/.source +
    /([0-9][0-9-]{5,})/.source,
);
const INVOICE =
  /(?:เลขที่ใบกำกับภาษี|เลขที่ใบกำกับ|เลขที่ใบเสร็จ|invoice\s*no\.?|inv\.?\s*no\.?)\W{0,6}([A-Za-z0-9\-/]{4,})/i;

function fuelTypeOf(t: string): FuelType | null {
  if (/ดีเซล|diesel|\bb(?:7|10|20)\b/i.test(t)) return 'diesel';
  if (/แก๊สโซฮอล์|แก๊สโซฮอล|เบนซิน|gasohol|gasoline|\be(?:20|85)\b|ออกเทน/i.test(t)) return 'gasoline';
  return null;
}

// บิลไฟ/น้ำ: 1) 'ประจำเดือน ... ' 2) ช่วง 'ระหว่าง/ตั้งแต่ วันที่ ... ถึง ...'
function detectMonth(t: string) {
  const m = new RegExp(/ประจำ(?:เดือน)?\s*/.source + MONTH_RE + /\s*(\d{2,4})/.source).exec(t);
  if (m) {
    const mo = monthNo(m[1]);
    if (mo) return { month: iso(toCE(+m[2]), mo, 1), start: null, end: null, span: false };
  }
  const at = t.search(/ระหว่าง|ตั้งแต่|รอบบิล|ช่วงวันที่/);
  if (at >= 0) {
    const ds = findDates(t.slice(at, at + 90));
    if (ds.length >= 2) {
      const r = majorityMonth(ds[0].iso, ds[1].iso);
      if (r) return { month: r.month, start: ds[0].iso, end: ds[1].iso, span: r.spansTwoMonths };
    }
  }
  return null;
}

export function parseBill(text: string, type: BillType, source: Extracted['source']): Extracted {
  let quantity: number | null = null;
  for (const re of QTY_RULES[type]) {
    const q = toNum(re.exec(text)?.[1]);
    if (q !== null && q > 0) { quantity = q; break; }
  }

  const accountNo = ACCOUNT.exec(text)?.[1]?.replace(/-/g, '') ?? null;
  const invoiceNo = INVOICE.exec(text)?.[1] ?? null;

  let billMonth: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let spansTwoMonths = false;
  let billDate: string | null = null;

  if (type === 'fuel') {
    const d = findDates(text)[0];
    if (d) { billDate = d.iso; billMonth = d.iso.slice(0, 7) + '-01'; }
  } else {
    const r = detectMonth(text);
    if (r) { billMonth = r.month; periodStart = r.start; periodEnd = r.end; spansTwoMonths = r.span; }
  }

  // กุญแจกันบิลซ้ำจากเนื้อหา (ต่อให้ถ่ายรูปคนละใบก็ซ้ำได้)
  const dedupKey =
    type === 'fuel'
      ? billDate && invoiceNo ? `fuel|${billDate}|${invoiceNo}` : null
      : accountNo && billMonth ? `${type}|${accountNo}|${billMonth}` : null;

  return {
    billType: type,
    source,
    billMonth,
    periodStart,
    periodEnd,
    spansTwoMonths,
    billDate,
    quantity,
    unit: type === 'electricity' ? 'kWh' : type === 'water' ? 'm3' : 'L',
    accountNo,
    invoiceNo,
    fuelType: type === 'fuel' ? fuelTypeOf(text) : null,
    dedupKey,
    confidence: quantity !== null && billMonth !== null ? 'high' : 'low',
  };
}