// ชนิดข้อมูลของโหมด "จำลองโครงการ T-VER จากเป้าหมายการกักเก็บคาร์บอน"
// ตารางอยู่ใน supabase/tver_target_plan.sql (เก็บเฉพาะค่าที่องค์กรกรอก ผลลัพธ์คำนวณใหม่ทุกครั้ง)
// ตาราง org_tree_target_species / org_tree_target_plot เลิกใช้แล้ว (ไม่กรอกพันธุ์และแปลงแล้ว)

// แผน 1 แผน (org_tree_target_plan)
export interface OrgTreeTargetPlan {
  targetplan_id: string;
  org_id: string;
  project_name: string;
  target_tco2e: number; // เป้าหมายการกักเก็บ (tCO2e)
  target_year: number; // ปีที่ t (1-10)
  created_at: string;
  updated_at: string;
}

// แผนที่บันทึกไว้ (ใช้แค่ id + ชื่อ แสดงใน dropdown)
export type SavedTargetPlanOption = { targetplan_id: string; project_name: string };

// ชื่อเงื่อนไข (detail_name) ในหน้าแอดมิน T-VER Project ที่โหมดนี้ใช้เป็นเพดานพื้นที่
// ต้องตรงกับในตาราง tver_project_detail ทุกตัวอักษร ถ้าหาไม่เจอจะใช้ค่าตามเกณฑ์ T-VER แทน
//   พื้นที่โครงการ ใช้ชื่อเดียวกับ TVER_AREA_NAME ใน types/tver-project.ts
export const TVER_SUBPLOT_NAME = 'ขนาดแปลงย่อย';
