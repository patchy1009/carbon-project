export interface TreeListItem {
  tree_id: string;
  tree_name: string | null;
  admin_id: string | null;
  updated_at: string;
}

export interface TverProjectDetail {
  tverdetail_id: string;
  detail_name: string | null;
  unit: string | null;
  // เงื่อนไขแยกเป็น 2 คอลัมน์ (แทน condition_value เดิม ดู supabase/tver_condition_columns.sql)
  // ว่างทั้งคู่ = ไม่มีเงื่อนไข
  condition_operator: '>' | '>=' | '<' | '<=' | '=' | null;
  condition_number: number | null;
  detail: string | null;
  admin_id: string | null;
  updated_at: string;
}

// ชื่อเงื่อนไข (detail_name) ที่ระบบใช้คำนวณและแสดงผล ต้องตรงกับในตาราง tver_project_detail ทุกตัวอักษร
// ถ้าแอดมินเปลี่ยนชื่อหรือลบเงื่อนไข ระบบจะหาไม่เจอ และเว้นค่านั้นไว้
export const TVER_AREA_NAME = 'พื้นที่โครงการ';
export const TVER_TREE_COUNT_NAME = 'จำนวนต้นไม้';