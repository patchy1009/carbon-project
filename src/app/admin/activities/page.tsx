export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import ActivityManagementClient from './ActivityManagementClient';
import type { CarbonScope, Activity, ActivityDetail } from '@/types/activity-management';

export default async function ActivityManagementPage() {
  const [scopesRes, activitiesRes, detailsRes] = await Promise.all([
    supabase.from('carbon_scope').select('*').order('scope_number'),
    supabase
      .from('activity')
      .select('*, carbon_scope(scope_id, scope_name, scope_number)')
      .order('updated_at'),
    supabase
      .from('activity_detail')
      .select(
        `*,
        activity(activity_id, activity_name, scope_id, carbon_scope(scope_id, scope_name, scope_number)),
        emission_factor(ef_id, ef_name, ef_value, real_unit),
        global_warming_potential(gwp_id, gas_name, gwp_value)`
      )
      .order('updated_at'),
  ]);

  return (
    <ActivityManagementClient
      initialScopes={(scopesRes.data ?? []) as CarbonScope[]}
      initialActivities={(activitiesRes.data ?? []) as Activity[]}
      initialDetails={(detailsRes.data ?? []) as ActivityDetail[]}
    />
  );
}