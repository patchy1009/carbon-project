export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          activity_id: string
          activity_name: string | null
          scope_id: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string
          activity_name?: string | null
          scope_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string
          activity_name?: string | null
          scope_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "carbon_scope"
            referencedColumns: ["scope_id"]
          },
        ]
      }
      activity_detail: {
        Row: {
          activity_id: string | null
          description: string | null
          detail_name: string | null
          ef_id: string | null
          gwp_id: string | null
          scopedetail_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          description?: string | null
          detail_name?: string | null
          ef_id?: string | null
          gwp_id?: string | null
          scopedetail_id?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          description?: string | null
          detail_name?: string | null
          ef_id?: string | null
          gwp_id?: string | null
          scopedetail_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_detail_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_detail_ef_id_fkey"
            columns: ["ef_id"]
            isOneToOne: false
            referencedRelation: "emission_factor"
            referencedColumns: ["ef_id"]
          },
          {
            foreignKeyName: "activity_detail_gwp_id_fkey"
            columns: ["gwp_id"]
            isOneToOne: false
            referencedRelation: "global_warming_potential"
            referencedColumns: ["gwp_id"]
          },
        ]
      }
      carbon_reduction_recommendation: {
        Row: {
          admin_id: string
          carbon_reduction_amount: number | null
          rec_id: string
          recommendation: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string
          carbon_reduction_amount?: number | null
          rec_id?: string
          recommendation?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          carbon_reduction_amount?: number | null
          rec_id?: string
          recommendation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      carbon_scope: {
        Row: {
          admin_id: string | null
          scope_detail: string | null
          scope_id: string
          scope_name: string | null
          scope_number: number | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          scope_detail?: string | null
          scope_id?: string
          scope_name?: string | null
          scope_number?: number | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          scope_detail?: string | null
          scope_id?: string
          scope_name?: string | null
          scope_number?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          admin_id: string | null
          document_id: string
          document_name: string | null
          file_path: string | null
          upload_date: string
        }
        Insert: {
          admin_id?: string | null
          document_id?: string
          document_name?: string | null
          file_path?: string | null
          upload_date?: string
        }
        Update: {
          admin_id?: string | null
          document_id?: string
          document_name?: string | null
          file_path?: string | null
          upload_date?: string
        }
        Relationships: []
      }
      ef_type: {
        Row: {
          eftype_id: string
          type_name: string | null
          updated_date: string
        }
        Insert: {
          eftype_id?: string
          type_name?: string | null
          updated_date?: string
        }
        Update: {
          eftype_id?: string
          type_name?: string | null
          updated_date?: string
        }
        Relationships: []
      }
      emission_factor: {
        Row: {
          admin_id: string | null
          ef_id: string
          ef_name: string | null
          ef_value: number | null
          eftype_id: string | null
          real_unit: string | null
          updated_date: string
        }
        Insert: {
          admin_id?: string | null
          ef_id?: string
          ef_name?: string | null
          ef_value?: number | null
          eftype_id?: string | null
          real_unit?: string | null
          updated_date?: string
        }
        Update: {
          admin_id?: string | null
          ef_id?: string
          ef_name?: string | null
          ef_value?: number | null
          eftype_id?: string | null
          real_unit?: string | null
          updated_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "emission_factor_eftype_id_fkey"
            columns: ["eftype_id"]
            isOneToOne: false
            referencedRelation: "ef_type"
            referencedColumns: ["eftype_id"]
          },
        ]
      }
      global_warming_potential: {
        Row: {
          admin_id: string | null
          created_at: string
          gas_name: string | null
          gwp_id: string
          gwp_value: number | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          gas_name?: string | null
          gwp_id?: string
          gwp_value?: number | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          gas_name?: string | null
          gwp_id?: string
          gwp_value?: number | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempts: number | null
          id: number
          identifier: string
          locked_until: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          id?: number
          identifier: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          id?: number
          identifier?: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      office_info_type: {
        Row: {
          admin_id: string | null
          info_detail: string | null
          info_id: string
          info_name: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          info_detail?: string | null
          info_id?: string
          info_name?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          info_detail?: string | null
          info_id?: string
          info_name?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      org_activity_detail: {
        Row: {
          amount: number | null
          ghg_emission: number | null
          orgactdetail_id: string
          orgactlist_id: string | null
          scopedetail_id: string | null
          unit: string | null
        }
        Insert: {
          amount?: number | null
          ghg_emission?: number | null
          orgactdetail_id?: string
          orgactlist_id?: string | null
          scopedetail_id?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number | null
          ghg_emission?: number | null
          orgactdetail_id?: string
          orgactlist_id?: string | null
          scopedetail_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_activity_detail_orgactlist_id_fkey"
            columns: ["orgactlist_id"]
            isOneToOne: false
            referencedRelation: "org_activity_list"
            referencedColumns: ["orgactlist_id"]
          },
          {
            foreignKeyName: "org_activity_detail_scopedetail_id_fkey"
            columns: ["scopedetail_id"]
            isOneToOne: false
            referencedRelation: "activity_detail"
            referencedColumns: ["scopedetail_id"]
          },
        ]
      }
      org_activity_list: {
        Row: {
          created_at: string
          org_id: string | null
          orgact_name: string | null
          orgactlist_id: string
          total_ghg_emission: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          org_id?: string | null
          orgact_name?: string | null
          orgactlist_id?: string
          total_ghg_emission?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          org_id?: string | null
          orgact_name?: string | null
          orgactlist_id?: string
          total_ghg_emission?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      org_office_info: {
        Row: {
          amount: string | null
          info_id: string | null
          org_id: string | null
          orginfo_id: string
          updated_at: string
        }
        Insert: {
          amount?: string | null
          info_id?: string | null
          org_id?: string | null
          orginfo_id?: string
          updated_at?: string
        }
        Update: {
          amount?: string | null
          info_id?: string | null
          org_id?: string | null
          orginfo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_office_info_info_id_fkey"
            columns: ["info_id"]
            isOneToOne: false
            referencedRelation: "office_info_type"
            referencedColumns: ["info_id"]
          },
        ]
      }
      org_tree_project: {
        Row: {
          created_at: string
          credit_year_1: number | null
          credit_year_2: number | null
          credit_year_3: number | null
          join_year: number | null
          org_id: string | null
          orgtreeproject_id: string
          project_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          credit_year_1?: number | null
          credit_year_2?: number | null
          credit_year_3?: number | null
          join_year?: number | null
          org_id?: string | null
          orgtreeproject_id?: string
          project_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          credit_year_1?: number | null
          credit_year_2?: number | null
          credit_year_3?: number | null
          join_year?: number | null
          org_id?: string | null
          orgtreeproject_id?: string
          project_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      org_tree_project_detail: {
        Row: {
          amount: number | null
          orgtreeproject_id: string | null
          orgtreeprojectdetail_id: string
          tree_id: string | null
          tverdetail_id: string | null
          unit: string | null
        }
        Insert: {
          amount?: number | null
          orgtreeproject_id?: string | null
          orgtreeprojectdetail_id?: string
          tree_id?: string | null
          tverdetail_id?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number | null
          orgtreeproject_id?: string | null
          orgtreeprojectdetail_id?: string
          tree_id?: string | null
          tverdetail_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_tree_project_detail_orgtreeproject_id_fkey"
            columns: ["orgtreeproject_id"]
            isOneToOne: false
            referencedRelation: "org_tree_project"
            referencedColumns: ["orgtreeproject_id"]
          },
          {
            foreignKeyName: "org_tree_project_detail_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "tree_list"
            referencedColumns: ["tree_id"]
          },
          {
            foreignKeyName: "org_tree_project_detail_tverdetail_id_fkey"
            columns: ["tverdetail_id"]
            isOneToOne: false
            referencedRelation: "tver_project_detail"
            referencedColumns: ["tverdetail_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      tree_list: {
        Row: {
          admin_id: string | null
          tree_id: string
          tree_name: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          tree_id?: string
          tree_name?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          tree_id?: string
          tree_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tver_project_detail: {
        Row: {
          admin_id: string | null
          condition_value: string | null
          detail: string | null
          detail_name: string | null
          tverdetail_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          condition_value?: string | null
          detail?: string | null
          detail_name?: string | null
          tverdetail_id?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          condition_value?: string | null
          detail?: string | null
          detail_name?: string | null
          tverdetail_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
