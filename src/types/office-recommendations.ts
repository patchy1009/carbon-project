export interface OfficeInfoType {
  info_id: string;
  info_name: string | null;
  info_detail: string | null;
  unit: string | null;
  admin_id: string | null;
  updated_at: string;
}

export interface CarbonReductionRecommendation {
  rec_id: string;
  recommendation: string | null;
  carbon_reduction_amount: number | null;
  admin_id: string | null;
  updated_at: string;
}