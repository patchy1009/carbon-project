import {
  required, notNumericOnly, thaiOrEnglishOnly, isDecimal, maxLength, type formSchema,
} from '@/lib/validation';
import { normalizeNumberString, normalizeTextArea } from '@/lib/normalization';

/* [เพิ่มใหม่] schema ของหน้า "สำนักงาน & คำแนะนำ"
 * เดิมหน้านี้มีฟังก์ชันตรวจของตัวเอง (cleanText / cleanNumber / isNumeric / isNumberOnlyText)
 * ซึ่งซ้ำกับไฟล์กลาง จึงย้ายมาใช้ validation.ts / normalization.ts ให้เหมือนหน้าอื่น
 * กฎที่ต้องใช้ข้อมูลบนหน้าจอ (ห้ามซ้ำ / ต้องมีอยู่จริง) ใส่เพิ่มตอน submit ด้วย extendSchema */

/* หัวข้อข้อมูลสำนักงาน */
export type InfoField = 'info_name' | 'unit' | 'info_detail';
export const infoSchema: formSchema<InfoField> = {
  info_name: {
    rules: [required('ชื่อหัวข้อ'), notNumericOnly('ชื่อหัวข้อ'), maxLength('ชื่อหัวข้อ', 150)],
  },
  // หน่วยเป็นภาษาไทยได้ เช่น คน, ตร.ม., kWh/ปี  (เว้นว่างได้ = บริษัทกรอกเป็นข้อความ)
  unit: {
    rules: [thaiOrEnglishOnly('หน่วย'), notNumericOnly('หน่วย'), maxLength('หน่วย', 50)],
  },
  info_detail: {
    normalize: normalizeTextArea,
    rules: [notNumericOnly('คำอธิบาย'), maxLength('คำอธิบาย', 1000)],
  },
};

/* แนวทางลดคาร์บอน */
export type RecField = 'recommendation' | 'percent_min' | 'percent_max' | 'scopedetail_id';
// เปอร์เซ็นต์ที่ลดได้: มากกว่า 0 ไม่เกิน 100 ทศนิยมไม่เกิน 2 หลัก
const percentRule = (label: string) =>
  isDecimal(label, { allowNegative: false, allowZero: false, max: 100, maxDecimals: 2 });
export const recSchema: formSchema<RecField> = {
  recommendation: {
    rules: [required('ชื่อแนวทาง'), notNumericOnly('ชื่อแนวทาง'), maxLength('ชื่อแนวทาง', 255)],
  },
  percent_min: {
    normalize: normalizeNumberString,
    rules: [required('เปอร์เซ็นต์ที่ลดได้'), percentRule('เปอร์เซ็นต์ที่ลดได้')],
  },
  percent_max: {
    normalize: normalizeNumberString,
    rules: [percentRule('เปอร์เซ็นต์สูงสุด')], // เว้นว่าง = ค่าเดียว
  },
  scopedetail_id: { rules: [] }, // ไม่บังคับ แต่ถ้าเลือกต้องมีอยู่จริง (existsIn ตอน submit)
};

/* ค่าที่ใช้เทียบในเงื่อนไข: ไม่ติดลบ ทศนิยมไม่เกิน 4 หลัก (ใช้กับ validateForm ทีละเงื่อนไข) */
export type CondValueField = 'value';
export const condValueSchema: formSchema<CondValueField> = {
  value: {
    normalize: normalizeNumberString,
    rules: [required('ค่าที่ใช้เทียบ'), isDecimal('ค่าที่ใช้เทียบ', { allowNegative: false, maxDecimals: 4 })],
  },
};
