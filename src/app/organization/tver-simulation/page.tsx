export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import TverSimulationClient from './TverSimulationClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';

export default async function TverSimulationPage() {
  const [treesRes, criteriaRes] = await Promise.all([
    supabase.from('tree_list').select('*').order('tree_name'),
    supabase.from('tver_project_detail').select('*').order('updated_at'),
  ]);

  return (
    <TverSimulationClient
      trees={(treesRes.data ?? []) as TreeListItem[]}
      criteria={(criteriaRes.data ?? []) as TverProjectDetail[]}
    />
  );
}