// ส่วนที่ทำงานฝั่ง server ของหน้าจำลอง T-VER สำหรับโครงการใหม่
export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import TverSimulationClient, { type SavedProjectOption } from './TverSimulationClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';

// ดึงรายการต้นไม้และเงื่อนไขโครงการ แล้วส่งให้หน้าจอ
export default async function TverSimulationPage() {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const [treesRes, criteriaRes, savedRes] = await Promise.all([
    supabase.from('tree_list').select('*').order('tree_name'),
    supabase.from('tver_project_detail').select('*').order('updated_at'),
    // รายชื่อโครงการที่องค์กรนี้บันทึกไว้ (ให้ dropdown "โครงการที่บันทึกไว้" เลือกเปิดได้)
    supabase.from('org_tree_project').select('orgtreeproject_id, project_name').eq('org_id', orgId).order('project_name'),
  ]);

  return (
    <TverSimulationClient
      orgId={orgId}
      trees={(treesRes.data ?? []) as TreeListItem[]}
      criteria={(criteriaRes.data ?? []) as TverProjectDetail[]}
      savedProjects={(savedRes.data ?? []) as SavedProjectOption[]}
    />
  );
}