export type { OrgTreeProject } from './dashboard';

export interface OrgTreeProjectDetail {
  orgtreeprojectdetail_id: string;
  orgtreeproject_id: string | null;
  tree_id: string | null;
  tverdetail_id: string | null;
  amount: number | null;
  unit: string | null;
}