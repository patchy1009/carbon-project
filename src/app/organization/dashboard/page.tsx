export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import DashboardClient from './DashboardClient';
import type { OrgActivityLog, OrgTreeProject } from '@/types/dashboard';

export default async function DashboardPage() {
  // ===== ยังไม่ผูก Auth จริง (TODO: ทำทีหลัง) =====
  // const { data: { user } } = await supabase.auth.getUser();
  // const { data: org } = await supabase
  //   .from('organization')
  //   .select('org_id')
  //   .eq('user_id', user?.id)
  //   .single();
  // const orgId = org?.org_id ?? null;

  // ===== โหมดชั่วคราว: ใส่ org_id ของบริษัททดสอบตรงๆ ก่อน =====
  // ไปเอา org_id จริงจากตาราง organization ใน Supabase Table Editor มาแปะตรงนี้
  const orgId = 'ใส่-org-id-ทดสอบ-ตรงนี้';

  const [activityRes, treeProjectRes] = await Promise.all([
    supabase
      .from('org_activity_list')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('org_tree_project')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <DashboardClient
      activities={(activityRes.data ?? []) as OrgActivityLog[]}
      treeProjects={(treeProjectRes.data ?? []) as OrgTreeProject[]}
    />
  );
}