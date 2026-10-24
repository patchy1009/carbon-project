import {
  required, notNumericOnly, englishOnly, isDecimal, isPositiveInteger, type formSchema,} from '@/lib/validation';
import { normalizeNumberString, normalizeTextArea} from '@/lib/normalization';

export type ScopeField = 'scope_number' | 'scope_name' | 'scope_detail';
export const scopeSchema: formSchema<ScopeField> = {
  scope_number: {
    normalize: normalizeNumberString,
    rules: [required('หมายเลขสโคป'), isPositiveInteger('หมายเลขสโคป')],
  },
  scope_name: {
    rules: [required('ชื่อขอบเขต'), notNumericOnly('ชื่อขอบเขต')],
  },
  scope_detail: {
    normalize: normalizeTextArea,                 // textarea: ให้ขึ้นบรรทัดใหม่ได้
    rules: [notNumericOnly('รายละเอียด')],          // ไม่ใส่ required = เว้นว่างได้
  },
};

export type ActivityField = 'scope_id' | 'activity_name';
export const activitySchema: formSchema<ActivityField> = {
  scope_id: { rules: [required('สโคป')] },        // dropdown ต้องเลือก
  activity_name: {
    rules: [required('ชื่อกิจกรรม'), notNumericOnly('ชื่อกิจกรรม')],
  },
};

export type DetailField = 'activity_id' | 'detail_name' | 'unit' | 'description' | 'ef_id' | 'gwp_id' ;
export const detailSchema: formSchema<DetailField> = {
  activity_id: { rules: [required('กิจกรรม')] },
  detail_name: {
    rules: [required('ชื่อรายละเอียด'), notNumericOnly('ชื่อรายละเอียด')],
  },
  unit: { rules: [required('หน่วย'), englishOnly('หน่วย')] },
  description: {
    normalize: normalizeTextArea,
    rules: [notNumericOnly('รายละเอียด')],
  },
  ef_id: {
    rules: [],
  },
  gwp_id: {
    rules: []
  }
};