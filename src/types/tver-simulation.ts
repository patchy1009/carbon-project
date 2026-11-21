// ชนิดข้อมูลของหน้าจำลองโครงการ T-VER
export type { OrgTreeProject } from './dashboard';

export interface OrgTreeProjectDetail {
  orgtreeprojectdetail_id: string;
  orgtreeproject_id: string | null;
  tree_id: string | null; // ไม่ใช้แล้ว (เอาพันธุ์ไม้ออก) คอลัมน์ยังอยู่ใน DB ค่าเป็น null
  tverdetail_id: string | null;
  amount: number | null;
  unit: string | null;
}