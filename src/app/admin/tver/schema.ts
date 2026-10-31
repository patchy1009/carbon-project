import {
  required, notNumericOnly, thaiOrEnglishOnly, isDecimal, existsIn, maxLength, type formSchema,
} from '@/lib/validation';
import { normalizeNumberString, normalizeTextArea, CONDITION_OPERATORS } from '@/lib/normalization';

/* [เพิ่มใหม่] schema ของหน้า T-VER Project
 * เดิมหน้านี้บันทึกค่าที่กรอกลง DB ตรงๆ ไม่มี normalize / validate เลย
 * กฎที่ต้องใช้ข้อมูลบนหน้าจอ (ห้ามซ้ำ / กรอกคู่กัน) ใส่เพิ่มตอน submit ด้วย extendSchema ใน TverProjectClient.tsx */

/* รายการต้นไม้ */
export type TreeField = 'tree_name';
export const treeSchema: formSchema<TreeField> = {
  tree_name: {
    rules: [required('ชื่อต้นไม้'), notNumericOnly('ชื่อต้นไม้'), maxLength('ชื่อต้นไม้', 100)],
  },
};

/* เงื่อนไขโครงการ */
export type TverDetailField = 'detail_name' | 'unit' | 'condition_operator' | 'condition_number' | 'detail';
export const tverDetailSchema: formSchema<TverDetailField> = {
  detail_name: {
    rules: [required('รายละเอียดโครงการ'), notNumericOnly('รายละเอียดโครงการ'), maxLength('รายละเอียดโครงการ', 150)],
  },
  // หน่วยเป็นภาษาไทยได้ เช่น ไร่, แปลง, ต้น, ปี
  unit: {
    rules: [thaiOrEnglishOnly('หน่วย'), notNumericOnly('หน่วย'), maxLength('หน่วย', 50)],
  },
  // [แก้ไข] เดิมเป็นช่องข้อความ condition_value ให้พิมพ์ "<= 1000" เอง
  // ตอนนี้แยกเป็น dropdown ตัวดำเนินการ + ช่องตัวเลข (ไม่บังคับ: ว่างทั้งคู่ = ไม่มีเงื่อนไข)
  // ตัวดำเนินการต้องเป็นค่าใน dropdown เท่านั้น (กันค่าที่ถูกแก้ผ่าน DevTools)
  condition_operator: {
    rules: [existsIn('เงื่อนไข', CONDITION_OPERATORS.map((o) => o.value))],
  },
  // ค่าเงื่อนไข: แปลงเลขไทย/ลบ comma, ไม่ติดลบ (ตรงกับ check constraint ใน DB)
  condition_number: {
    normalize: normalizeNumberString,
    rules: [isDecimal('ค่าเงื่อนไข', { allowNegative: false })],
  },
  detail: {
    normalize: normalizeTextArea,
    rules: [notNumericOnly('คำอธิบาย'), maxLength('คำอธิบาย', 1000)],
  },
};
