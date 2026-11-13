import { required, notNumericOnly, isDecimal, maxLength, type formSchema } from '@/lib/validation';
import { normalizeNumberString } from '@/lib/normalization';

/* schema ของหน้า Allocation & TAX & Doc */

/* เอกสารโครงการ (บันทึกลงตาราง documents + Storage bucket documents) */
export type DocField = 'document_name';
export const docSchema: formSchema<DocField> = {
  document_name: {
    rules: [required('ชื่อเอกสาร'), notNumericOnly('ชื่อเอกสาร'), maxLength('ชื่อเอกสาร', 255)],
  },
};

// ข้อกำหนดไฟล์ที่แนบ: ตรงกับข้อความที่แสดงในหน้าเว็บ "รองรับ PDF, DOCX, XLSX (สูงสุด 25MB)"
export const DOC_FILE_RULE = {
  label: 'ไฟล์เอกสาร',
  maxBytes: 25 * 1024 * 1024,
  extensions: ['pdf', 'docx', 'xlsx'],
};

/* รายการต้นทุนมาตรฐาน (บันทึกลงตาราง project_cost_type) ข้อ 5.5
 * ชื่อห้ามว่าง / ตัวเลขล้วน / ยาวเกิน 150 ห้ามซ้ำ (ใส่เพิ่มตอน submit ด้วย extendSchema และมี unique ที่ DB อีกชั้น)
 * ราคาไม่ติดลบ ทศนิยมไม่เกิน 2 หลัก ส่วนเพดานราคาตรวจแยกใน checkCostPrice */
export type CostField = 'name' | 'price';
export const costSchema: formSchema<CostField> = {
  name: {
    rules: [required('ชื่อรายการต้นทุน'), notNumericOnly('ชื่อรายการต้นทุน'), maxLength('ชื่อรายการต้นทุน', 150)],
  },
  price: {
    normalize: normalizeNumberString,
    rules: [required('ราคา'), isDecimal('ราคา', { allowNegative: false, maxDecimals: 2 })],
  },
};

// ราคาต้องน้อยกว่านี้ เพื่อให้ราคาสุทธิ (รวม VAT) ไม่เกินขนาดคอลัมน์ numeric ใน DB
export const MAX_COST_PRICE = 10_000_000;

// ตรวจเพดานราคา (รับสตริงที่ผ่าน validateForm แล้ว) คืนข้อความ error หรือ undefined ถ้าผ่าน
// เขียนเป็นฟังก์ชันธรรมดา ไม่ใช่ rule ของ validation เพราะ rule ของโปรเจกต์ห้ามคืนค่า null
export function checkCostPrice(cleanPrice: string): string | undefined {
  const n = Number(cleanPrice);
  return Number.isFinite(n) && n >= MAX_COST_PRICE ? 'ราคาสูงเกินไป' : undefined;
}

/* เป้าหมายโครงการ (บันทึกลงตาราง project_target_rule) ข้อ 5.4
 * ชื่อห้ามว่าง / ตัวเลขล้วน / ยาวเกิน 100 (ตรงกับ varchar(100)) ห้ามซ้ำ ใส่เพิ่มตอน submit ด้วย extendSchema
 * สัดส่วนชดเชย (จำนวนเต็ม 0-100) ตรวจแยกในหน้าจอ เพราะช่อง "ขาย" คำนวณเองจาก 100 - ชดเชย */
export type TargetField = 'target_name';
export const targetSchema: formSchema<TargetField> = {
  target_name: {
    rules: [required('ชื่อเป้าหมาย'), notNumericOnly('ชื่อเป้าหมาย'), maxLength('ชื่อเป้าหมาย', 100)],
  },
};