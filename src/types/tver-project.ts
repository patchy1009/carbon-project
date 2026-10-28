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
  // [แก้ไข] เงื่อนไขแยกเป็น 2 คอลัมน์ (แทน condition_value เดิม ดู supabase/tver_condition_columns.sql)
  // ว่างทั้งคู่ = ไม่มีเงื่อนไข
  condition_operator: '>' | '>=' | '<' | '<=' | '=' | null;
  condition_number: number | null;
  detail: string | null;
  admin_id: string | null;
  updated_at: string;
}