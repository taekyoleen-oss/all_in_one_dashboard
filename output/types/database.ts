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
      pb_card_transactions: {
        Row: {
          amount: number
          card_id: string
          category: string | null
          id: string
          merchant: string | null
          raw_hash: string
          source: string
          txn_date: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id: string
          category?: string | null
          id?: string
          merchant?: string | null
          raw_hash: string
          source: string
          txn_date: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string
          category?: string | null
          id?: string
          merchant?: string | null
          raw_hash?: string
          source?: string
          txn_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pb_card_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pb_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      pb_cards: {
        Row: {
          billing_day: number | null
          color: string | null
          id: string
          issuer: string | null
          last4: string | null
          nickname: string
          user_id: string
        }
        Insert: {
          billing_day?: number | null
          color?: string | null
          id?: string
          issuer?: string | null
          last4?: string | null
          nickname: string
          user_id: string
        }
        Update: {
          billing_day?: number | null
          color?: string | null
          id?: string
          issuer?: string | null
          last4?: string | null
          nickname?: string
          user_id?: string
        }
        Relationships: []
      }
      pb_circle_appointments: {
        Row: {
          content: string
          created_at: string
          id: string
          source: string | null
          target_id: string | null
          user_id: string
          when_at: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          source?: string | null
          target_id?: string | null
          user_id: string
          when_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          source?: string | null
          target_id?: string | null
          user_id?: string
          when_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pb_circle_appointments_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "pb_circle_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      pb_circle_targets: {
        Row: {
          color: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      pb_dashboards: {
        Row: {
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pb_user_settings: {
        Row: {
          default_dashboard_id: string | null
          google_connected: boolean
          ingest_token: string | null
          stock_config: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          default_dashboard_id?: string | null
          google_connected?: boolean
          ingest_token?: string | null
          stock_config?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          default_dashboard_id?: string | null
          google_connected?: boolean
          ingest_token?: string | null
          stock_config?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pb_user_settings_default_dashboard_fk"
            columns: ["default_dashboard_id"]
            isOneToOne: false
            referencedRelation: "pb_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      pb_widgets: {
        Row: {
          config: Json
          dashboard_id: string
          id: string
          layout: Json
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          dashboard_id: string
          id?: string
          layout?: Json
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          dashboard_id?: string
          id?: string
          layout?: Json
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pb_widgets_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "pb_dashboards"
            referencedColumns: ["id"]
          },
        ]
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
