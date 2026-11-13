// ชนิดข้อมูลของหน้า Dashboard องค์กร (ตรงกับคอลัมน์ในตาราง)
export interface OrgActivityLog {
  orgactlist_id: string;
  orgact_name: string | null;
  total_ghg_emission: number | null;
  unit: string | null;
  org_id: string | null;
  period_type: string | null;
  period_date: string | null; // 'YYYY-MM-01' (ค.ศ.) รายปีใช้ 1 ม.ค.
  created_at: string;
  updated_at: string | null;
}

export interface OrgTreeProject {
  orgtreeproject_id: string;
  project_name: string | null;
  join_date: string | null; // 'YYYY-MM-DD' วันที่เข้าร่วมโครงการ (ใช้แทน join_year ที่ลบไปแล้ว)
  credit_year_1: number | null;
  credit_year_2: number | null;
  credit_year_3: number | null;
  org_id: string | null;
  created_at: string;
  updated_at: string | null;
  // ได้จากการ join ตอนดึงข้อมูลใน Dashboard (จำนวนที่กรอกของแต่ละเงื่อนไข)
  org_tree_project_detail?: {
    amount: number | null;
    tver_project_detail: { detail_name: string | null } | null;
  }[];
}