import {
  required, requiredSelect, notNumericOnly, englishOnly, isPositiveInteger, maxLength, type formSchema,} from '@/lib/validation';
import { normalizeNumberString, normalizeTextArea} from '@/lib/normalization';

/* กฎที่ต้องใช้ข้อมูลบนหน้าจอ (ห้ามซ้ำ / ตัวเลือกต้องมีอยู่จริง) ใส่เพิ่มตอน submit
 * ด้วย extendSchema(...) ใน ActivityManagementClient.tsx */

export type ScopeField = 'scope_number' | 'scope_name' | 'scope_detail';
export const scopeSchema: formSchema<ScopeField> = {
  scope_number: {
    normalize: normalizeNumberString,
    rules: [required('หมายเลขสโคป'), isPositiveInteger('หมายเลขสโคป')],
  },
  scope_name: {
    rules: [required('ชื่อขอบเขต'), notNumericOnly('ชื่อขอบเขต'), maxLength('ชื่อขอบเขต', 150)],
  },
  scope_detail: {
    normalize: normalizeTextArea,                 // textarea: ให้ขึ้นบรรทัดใหม่ได้
    rules: [notNumericOnly('รายละเอียด'), maxLength('รายละเอียด', 1000)], // ไม่ใส่ required = เว้นว่างได้
  },
};

export type ActivityField = 'scope_id' | 'activity_name';
export const activitySchema: formSchema<ActivityField> = {
  scope_id: { rules: [requiredSelect('สโคป')] },        // dropdown ต้องเลือก
  activity_name: {
    rules: [required('ชื่อกิจกรรม'), notNumericOnly('ชื่อกิจกรรม'), maxLength('ชื่อกิจกรรม', 150)],
  },
};

export type DetailField = 'activity_id' | 'detail_name' | 'unit' | 'description' | 'ef_id' | 'gwp_id' ;
export const detailSchema: formSchema<DetailField> = {
  activity_id: { rules: [requiredSelect('กิจกรรม')] },
  detail_name: {
    rules: [required('ชื่อรายละเอียด'), notNumericOnly('ชื่อรายละเอียด'), maxLength('ชื่อรายละเอียด', 150)],
  },
  unit: { rules: [required('หน่วย'), englishOnly('หน่วย'), maxLength('หน่วย', 50)] },
  description: {
    normalize: normalizeTextArea,
    rules: [notNumericOnly('รายละเอียด'), maxLength('รายละเอียด', 1000)],
  },
  // EF / GWP ไม่บังคับเลือก แต่ถ้าเลือกต้องมีอยู่จริง (existsIn ใส่เพิ่มตอน submit)
  ef_id: {
    rules: [],
  },
  gwp_id: {
    rules: []
  }
};
