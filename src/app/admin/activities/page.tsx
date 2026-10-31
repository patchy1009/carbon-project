export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireAdminId } from '@/lib/auth';
import ActivityManagementClient from './ActivityManagementClient';
import type { CarbonScope, Activity, ActivityDetail } from '@/types/activity-management';
import type { EmissionFactor, GwpValue } from '@/types/ef-gwp'; 

export default async function ActivityManagementPage() {
  await requireAdminId(); // ไม่ใช่แอดมิน -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const [scopesRes, activitiesRes, detailsRes, efRes, gwpRes] = await Promise.all([
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
    supabase.from('emission_factor').select('*'),
    supabase.from('global_warming_potential').select('*'),
  ]);

  return (
    <ActivityManagementClient
      initialScopes={(scopesRes.data ?? []) as CarbonScope[]}
      initialActivities={(activitiesRes.data ?? []) as Activity[]}
      initialDetails={(detailsRes.data ?? []) as ActivityDetail[]}
      initialEfOptions={(efRes.data ?? []) as EmissionFactor[]}
      initialGwpOptions={(gwpRes.data ?? []) as GwpValue[]}
    />
  );
}