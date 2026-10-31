export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import TverSimulationClient from '../TverSimulationClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';
import type { OrgTreeProject, OrgTreeProjectDetail } from '@/types/tver-simulation';

export default async function EditTverProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { id } = await params;

  const [projectRes, detailsRes, treesRes, criteriaRes] = await Promise.all([
    supabase
      .from('org_tree_project')
      .select('*')
      .eq('orgtreeproject_id', id)
      .eq('org_id', orgId) // กันเปิดดูโครงการขององค์กรอื่น
      .single(),
    supabase.from('org_tree_project_detail').select('*').eq('orgtreeproject_id', id),
    supabase.from('tree_list').select('*').order('tree_name'),
    supabase.from('tver_project_detail').select('*').order('updated_at'),
  ]);

  if (!projectRes.data) notFound(); // ไม่พบโครงการ -> แสดงหน้า 404

  return (
    <TverSimulationClient
      orgId={orgId}
      trees={(treesRes.data ?? []) as TreeListItem[]}
      criteria={(criteriaRes.data ?? []) as TverProjectDetail[]}
      existingProject={projectRes.data as OrgTreeProject}
      existingDetails={(detailsRes.data ?? []) as OrgTreeProjectDetail[]}
    />
  );
}