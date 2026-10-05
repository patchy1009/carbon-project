import type { CarbonScope } from './activity-management';

export interface ActivityDetailWithValues {
  scopedetail_id: string;
  detail_name: string | null;
  unit: string | null;
  activity: {
    activity_id: string;
    activity_name: string | null;
    scope_id: string | null;
  } | null;
  emission_factor: { ef_value: number | null } | null;
  global_warming_potential: { gwp_value: number | null } | null;
}

export interface ScopeGroup {
  scope: CarbonScope;
  details: ActivityDetailWithValues[];
}