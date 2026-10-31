export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireAdminId } from '@/lib/auth';
import TverProjectClient from './TverProjectClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';

export default async function TverProjectPage() {
  await requireAdminId(); // ไม่ใช่แอดมิน -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const [treesRes, detailsRes] = await Promise.all([
    supabase.from('tree_list').select('*').order('updated_at'),
    supabase.from('tver_project_detail').select('*').order('updated_at'),
  ]);

  return (
    <TverProjectClient
      initialTrees={(treesRes.data ?? []) as TreeListItem[]}
      initialDetails={(detailsRes.data ?? []) as TverProjectDetail[]}
    />
  );
}