import type { EmissionFactor, GwpValue } from './ef-gwp';

export interface CarbonScope {
  scope_id: string;
  scope_name: string | null;
  scope_number: number | null;
  scope_detail: string | null; // ← เพิ่มบรรทัดนี้
  admin_id: string | null;
  updated_at: string;
}

export interface Activity {
  activity_id: string;
  activity_name: string | null;
  scope_id: string | null;
  updated_at: string;
  carbon_scope?: CarbonScope | null;
}

export interface ActivityDetail {
  scopedetail_id: string;
  activity_id: string | null;
  detail_name: string | null;
  unit: string | null;
  description: string | null;
  ef_id: string | null;
  gwp_id: string | null;
  updated_at: string;
  activity?: (Pick<Activity, 'activity_id' | 'activity_name' | 'scope_id'> & {
    carbon_scope?: CarbonScope | null;
  }) | null;
  emission_factor?: Pick<EmissionFactor, 'ef_id' | 'ef_name' | 'ef_value' | 'real_unit'> | null;
  global_warming_potential?: Pick<GwpValue, 'gwp_id' | 'gas_name' | 'gwp_value'> | null;
}