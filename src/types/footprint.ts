import type { CarbonScope } from './activity-management';
import type { OcrSource } from '@/lib/bills/types';

export interface ActivityDetailWithValues {
  scopedetail_id: string;
  detail_name: string | null;
  unit: string | null;
  ocr_source: OcrSource | null; // [เพิ่ม] บิลที่เติมช่องนี้ (ดู supabase/activity_detail_ocr_source.sql)
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