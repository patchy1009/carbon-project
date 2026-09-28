export interface TreeListItem {
  tree_id: string;
  tree_name: string | null;
  admin_id: string | null;
  updated_at: string;
}

export interface TverProjectDetail {
  tverdetail_id: string;
  detail_name: string | null;
  unit: string | null;
  condition_value: string | null;
  detail: string | null;
  admin_id: string | null;
  updated_at: string;
}