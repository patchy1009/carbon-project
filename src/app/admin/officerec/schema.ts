import {
  required, requiredSelect, existsIn, notNumericOnly, thaiOrEnglishOnly, isDecimal, maxLength, type formSchema,
} from '@/lib/validation';
import { INFO_GROUPS } from '@/lib/officeInfoGroups';
import { normalizeNumberString, normalizeTextArea } from '@/lib/normalization';
import { noSqlSyntax } from '@/lib/sqlSyntax'; // ตรวจ Syntax ป้องกัน SQL Injection

/* schema ของหน้า "สำนักงาน & คำแนะนำ"
 * เดิมหน้านี้มีฟังก์ชันตรวจของตัวเอง (cleanText / cleanNumber / isNumeric / isNumberOnlyText)
 * ซึ่งซ้ำกับไฟล์กลาง จึงย้ายมาใช้ validation.ts / normalization.ts ให้เหมือนหน้าอื่น
 * กฎที่ต้องใช้ข้อมูลบนหน้าจอ (ห้ามซ้ำ / ต้องมีอยู่จริง) ใส่เพิ่มตอน submit ด้วย extendSchema */

/* หัวข้อข้อมูลสำนักงาน */
export type InfoField = 'info_group' | 'info_name' | 'unit' | 'info_detail';
export const infoSchema: formSchema<InfoField> = {
  // หมวด: ต้องเลือก และต้องเป็นหมวดที่ระบบกำหนด (supabase/office_info_group.sql)
  info_group: {
    rules: [requiredSelect('หมวด'), existsIn('หมวด', INFO_GROUPS)],
  },
  info_name: {
    rules: [required('ชื่อหัวข้อ'), notNumericOnly('ชื่อหัวข้อ'), maxLength('ชื่อหัวข้อ', 150), noSqlSyntax('ชื่อหัวข้อ')],
  },
  // หน่วยเป็นภาษาไทยได้ เช่น คน, ตร.ม., kWh/ปี  (เว้นว่างได้ = บริษัทกรอกเป็นข้อความ)
  unit: {
    rules: [thaiOrEnglishOnly('หน่วย'), notNumericOnly('หน่วย'), maxLength('หน่วย', 50), noSqlSyntax('หน่วย')],
  },
  info_detail: {
    normalize: normalizeTextArea,
    rules: [notNumericOnly('คำอธิบาย'), maxLength('คำอธิบาย', 1000), noSqlSyntax('คำอธิบาย')],
  },
};

/* แนวทางลดคาร์บอน */
// [ลบ] percent_max (% สูงสุดที่ลดได้) ไม่เก็บแล้ว เหลือ % เดียวคือ percent_min
export type RecField = 'recommendation' | 'percent_min' | 'scopedetail_id';
// เปอร์เซ็นต์ที่ลดได้: มากกว่า 0 ไม่เกิน 100 ทศนิยมไม่เกิน 2 หลัก
const percentRule = (label: string) =>
  isDecimal(label, { allowNegative: false, allowZero: false, max: 100, maxDecimals: 2 });
export const recSchema: formSchema<RecField> = {
  recommendation: {
    rules: [required('ชื่อแนวทาง'), notNumericOnly('ชื่อแนวทาง'), maxLength('ชื่อแนวทาง', 255), noSqlSyntax('ชื่อแนวทาง')],
  },
  // ไม่บังคับ: ไม่กรอก = แนะนำพร้อมค่าที่พบจากเงื่อนไข แต่ไม่คำนวณ tCO2e ที่ลดได้
  percent_min: {
    normalize: normalizeNumberString,
    rules: [percentRule('เปอร์เซ็นต์ที่ลดได้')],
  },
  scopedetail_id: { rules: [] }, // ไม่บังคับ แต่ถ้าเลือกต้องมีอยู่จริง (existsIn ตอน submit)
};

/* ชนิดของหัวข้อข้อมูลสำนักงาน (office_info_type.input_type) */
export type InputType = 'number' | 'percent' | 'text' | 'choice';
export const INPUT_TYPE_LABEL: Record<InputType, string> = {
  number: 'ตัวเลข',
  percent: 'เปอร์เซ็นต์ (0-100)',
  text: 'ข้อความ (ใช้ในเงื่อนไขไม่ได้)',
  choice: 'ตัวเลือก (เช่น ชนิดหลอดไฟ)',
};

/* ชื่อตัวเลือก 1 ตัวของหัวข้อแบบตัวเลือก (ตาราง office_info_option) ใช้กับ validateForm ทีละตัว */
export type OptionField = 'label';
export const optionSchema: formSchema<OptionField> = {
  label: {
    rules: [required('ชื่อตัวเลือก'), maxLength('ชื่อตัวเลือก', 100), noSqlSyntax('ชื่อตัวเลือก')],
  },
};

/* ค่าที่ใช้เทียบในเงื่อนไข: ไม่ติดลบ ทศนิยมไม่เกิน 4 หลัก (ใช้กับ validateForm ทีละเงื่อนไข) */
export type CondValueField = 'value';
export const condValueSchema: formSchema<CondValueField> = {
  value: {
    normalize: normalizeNumberString,
    rules: [required('ค่าที่ใช้เทียบ'), isDecimal('ค่าที่ใช้เทียบ', { allowNegative: false, maxDecimals: 4 })],
  },
};
