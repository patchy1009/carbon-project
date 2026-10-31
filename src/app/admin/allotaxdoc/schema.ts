import { required, notNumericOnly, isDecimal, maxLength, type formSchema } from '@/lib/validation';
import { normalizeNumberString } from '@/lib/normalization';

/* [เพิ่มใหม่] schema ของหน้า Allocation & TAX & Doc */

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

/* รายการต้นทุน (ตอนนี้ยังเก็บในหน้าเว็บเท่านั้น ยังไม่มีตารางใน DB แต่ตรวจไว้ก่อนให้พร้อมต่อ DB) */
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
