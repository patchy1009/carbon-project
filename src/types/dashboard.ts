export interface OrgActivityLog {
  orgactlist_id: string;
  orgact_name: string | null;
  total_ghg_emission: number | null;
  unit: string | null;
  org_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OrgTreeProject {
  orgtreeproject_id: string;
  project_name: string | null;
  join_year: number | null;
  credit_year_1: number | null;
  credit_year_2: number | null;
  credit_year_3: number | null;
  org_id: string | null;
  created_at: string;
  updated_at: string | null;
  // ได้จากการ join ตอนดึงข้อมูลใน Dashboard (พันธุ์ไม้เก็บอยู่ในแถวรายละเอียดของโครงการ)
  org_tree_project_detail?: {
    tree_id: string | null;
    tree_list: { tree_name: string | null } | null;
  }[];
}