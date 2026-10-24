export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import TverProjectClient from './TverProjectClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';

export default async function TverProjectPage() {
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