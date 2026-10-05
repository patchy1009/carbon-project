export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import FootprintClient from './FootprintClient';
import type { CarbonScope } from '@/types/activity-management';
import type { ActivityDetailWithValues, ScopeGroup } from '@/types/footprint';

export default async function FootprintPage() {
  const [scopesRes, detailsRes] = await Promise.all([
    supabase.from('carbon_scope').select('*').order('scope_number'),
    supabase.from('activity_detail').select(`
      scopedetail_id,
      detail_name,
      unit,
      activity(activity_id, activity_name, scope_id),
      emission_factor(ef_value),
      global_warming_potential(gwp_value)
    `),
  ]);

  const scopes = (scopesRes.data ?? []) as CarbonScope[];
  const details = (detailsRes.data ?? []) as unknown as ActivityDetailWithValues[];

  // จัดกลุ่ม activity_detail เข้าตาม scope ของมัน (ผ่าน activity.scope_id)
  const scopeGroups: ScopeGroup[] = scopes
    .slice()
    .sort((a, b) => (a.scope_number ?? 0) - (b.scope_number ?? 0))
    .map((scope) => ({
      scope,
      details: details.filter((d) => d.activity?.scope_id === scope.scope_id),
    }));

  return <FootprintClient scopeGroups={scopeGroups} />;
}