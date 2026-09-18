export interface EfType {
  eftype_id: string;
  type_name: string | null;
  updated_date: string;
}

export interface EmissionFactor {
  ef_id: string;
  ef_name: string | null;
  ef_value: number | null;
  real_unit: string | null;
  eftype_id: string | null;
  updated_date: string;
  ef_type?: EfType | null; // จาก join
}

export interface GwpValue {
  gwp_id: string;
  gas_name: string | null;
  gwp_value: number | null;
  created_at: string;
}

