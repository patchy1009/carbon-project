// lib/bills/units.ts
/* [เพิ่มใหม่] ตรวจและแปลงหน่วยจากบิล -> หน่วยของช่องกิจกรรม (activity_detail.unit)
 * เช่น บิลน้ำ OCR อ่านได้ 41,000 ลิตร แต่ช่องกิจกรรมเป็น ลบ.ม. -> เติม 41
 * ถ้าแปลงไม่ได้ (เช่น บิลไฟ kWh แต่ช่องเป็นลิตร) คืน null แล้วระบบจะไม่เติมให้ */
import { normalizeForCompare } from '@/lib/normalization';
import type { BillUnit } from './types';

// ชื่อหน่วยที่แอดมินอาจพิมพ์ไว้ (เทียบหลัง normalizeForCompare = ตัวเล็ก ไม่มีช่องว่าง) -> ตัวคูณจากหน่วยของบิล
const LITRE = ['l', 'litre', 'liter', 'litres', 'liters', 'ltr', 'ลิตร'];
const CUBIC_METRE = ['m3', 'm³', 'cum', 'cubicmeter', 'cubicmetre', 'ลบ.ม.', 'ลบ.ม', 'ลบม.', 'ลบม', 'ลูกบาศก์เมตร'];
const KWH = ['kwh', 'kw-h', 'kw.h', 'หน่วย', 'กิโลวัตต์ชั่วโมง'];
const MWH = ['mwh'];

const FACTORS: Record<BillUnit, [string[], number][]> = {
  L: [[LITRE, 1], [CUBIC_METRE, 0.001]],
  kWh: [[KWH, 1], [MWH, 0.001]],
};

/* ตัวคูณจากหน่วยของบิลไปเป็นหน่วยของช่องกิจกรรม คืน null ถ้าแปลงไม่ได้ */
export function unitFactor(from: BillUnit, detailUnit: string | null | undefined): number | null {
  const u = normalizeForCompare(detailUnit);
  if (!u) return null;
  for (const [names, factor] of FACTORS[from]) {
    if (names.some((n) => normalizeForCompare(n) === u)) return factor;
  }
  return null;
}

/* ตัดทศนิยมไม่เกิน 4 หลัก (ตรงกับที่ช่องปริมาณในฟอร์มยอมรับ) และกัน 0.1+0.2 = 0.30000000000000004 */
export const round4 = (n: number) => Math.round(n * 10000) / 10000;
