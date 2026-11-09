// ส่วนที่ทำงานฝั่ง server ของหน้า Dashboard: ดึงเฉพาะข้อมูลขององค์กรที่ล็อกอินอยู่
export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import DashboardClient from './DashboardClient';
import type { OrgActivityLog, OrgTreeProject } from '@/types/dashboard';

// ดึงรายการบันทึกและโครงการ T-VER เรียงตามวันที่ที่ผู้ใช้กรอก แล้วส่งให้หน้าจอ
export default async function DashboardPage() {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();

  const [activityRes, treeProjectRes] = await Promise.all([
    supabase
      .from('org_activity_list')
      .select('*')
      .eq('org_id', orgId)
      // เรียงตามช่วงเวลาที่ผู้ใช้กรอก (ล่าสุดอยู่บน) ถ้าช่วงเวลาเดียวกันค่อยดูวันที่สร้างในระบบ
      .order('period_month', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('org_tree_project')
      // ดึงจำนวนที่กรอก + ชื่อเงื่อนไข เพื่อหาจำนวนไร่และจำนวนต้นไม้ (เดิมดึงชื่อพันธุ์ไม้)
      .select('*, org_tree_project_detail(amount, tver_project_detail(detail_name))')
      .eq('org_id', orgId)
      // เรียงตามวันที่เข้าร่วมที่ผู้ใช้กรอก (ล่าสุดอยู่บน) รายการเก่าที่มีแค่ปีอยู่ท้ายสุดของปีนั้น
      .order('join_year', { ascending: false, nullsFirst: false })
      .order('join_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ]);

  return (
    <DashboardClient
      activities={(activityRes.data ?? []) as OrgActivityLog[]}
      // as unknown as: บอก TypeScript ว่าข้อมูลที่ join ตารางมามีรูปแบบตาม OrgTreeProject
      treeProjects={(treeProjectRes.data ?? []) as unknown as OrgTreeProject[]}
    />
  );
}