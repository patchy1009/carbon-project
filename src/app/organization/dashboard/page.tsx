export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import DashboardClient from './DashboardClient';
import type { OrgActivityLog, OrgTreeProject } from '@/types/dashboard';

export default async function DashboardPage() {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();

  const [activityRes, treeProjectRes] = await Promise.all([
    supabase
      .from('org_activity_list')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('org_tree_project')
      .select('*, org_tree_project_detail(tree_id, tree_list(tree_name))')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <DashboardClient
      activities={(activityRes.data ?? []) as OrgActivityLog[]}
      treeProjects={(treeProjectRes.data ?? []) as unknown as OrgTreeProject[]}
    />
  );
}