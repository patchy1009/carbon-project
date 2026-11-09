// ส่วนที่ทำงานฝั่ง server ของหน้าจำลอง T-VER สำหรับโครงการใหม่
export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import TverSimulationClient from './TverSimulationClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';

// ดึงรายการต้นไม้และเงื่อนไขโครงการ แล้วส่งให้หน้าจอ
export default async function TverSimulationPage() {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const [treesRes, criteriaRes] = await Promise.all([
    supabase.from('tree_list').select('*').order('tree_name'),
    supabase.from('tver_project_detail').select('*').order('updated_at'),
  ]);

  return (
    <TverSimulationClient
      orgId={orgId}
      trees={(treesRes.data ?? []) as TreeListItem[]}
      criteria={(criteriaRes.data ?? []) as TverProjectDetail[]}
    />
  );
}