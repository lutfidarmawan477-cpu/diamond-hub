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
      diamond_packages: {
        Row: {
          active: boolean
          badge: string | null
          best_seller: boolean
          created_at: string
          diamond_amount: number
          id: string
          name: string
          original_price: number | null
          price: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          badge?: string | null
          best_seller?: boolean
          created_at?: string
          diamond_amount: number
          id?: string
          name: string
          original_price?: number | null
          price: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          badge?: string | null
          best_seller?: boolean
          created_at?: string
          diamond_amount?: number
          id?: string
          name?: string
          original_price?: number | null
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      diamond_stock: {
        Row: {
          current_stock: number
          id: number
          updated_at: string
        }
        Insert: {
          current_stock?: number
          id?: number
          updated_at?: string
        }
        Update: {
          current_stock?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      diamond_stock_history: {
        Row: {
          activity_type: string
          admin_id: string | null
          amount: number
          created_at: string
          id: string
          note: string | null
          order_id: string | null
        }
        Insert: {
          activity_type: string
          admin_id?: string | null
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
        }
        Update: {
          activity_type?: string
          admin_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
        }
        Relationships: []
      }
      login_history: {
        Row: {
          created_at: string
          email: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_email: string
          buyer_name: string
          buyer_whatsapp: string
          created_at: string
          diamond_amount: number
          discount: number
          expires_at: string
          fee: number
          game_user_id: string
          id: string
          invoice_no: string
          nickname: string | null
          package_id: string
          package_name: string
          payment_method_id: string
          payment_method_name: string
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          voucher_id: string | null
          zone_id: string
        }
        Insert: {
          buyer_email: string
          buyer_name: string
          buyer_whatsapp: string
          created_at?: string
          diamond_amount: number
          discount?: number
          expires_at?: string
          fee?: number
          game_user_id: string
          id?: string
          invoice_no: string
          nickname?: string | null
          package_id: string
          package_name: string
          payment_method_id: string
          payment_method_name: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
          voucher_id?: string | null
          zone_id: string
        }
        Update: {
          buyer_email?: string
          buyer_name?: string
          buyer_whatsapp?: string
          created_at?: string
          diamond_amount?: number
          discount?: number
          expires_at?: string
          fee?: number
          game_user_id?: string
          id?: string
          invoice_no?: string
          nickname?: string | null
          package_id?: string
          package_name?: string
          payment_method_id?: string
          payment_method_name?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          voucher_id?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "diamond_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          code: string
          fee: number
          id: string
          name: string
          sort_order: number
          type: string
        }
        Insert: {
          active?: boolean
          code: string
          fee?: number
          id?: string
          name: string
          sort_order?: number
          type: string
        }
        Update: {
          active?: boolean
          code?: string
          fee?: number
          id?: string
          name?: string
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          member_level: string
          phone: string | null
          total_spent: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          member_level?: string
          phone?: string | null
          total_spent?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          member_level?: string
          phone?: string | null
          total_spent?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voucher_redemptions: {
        Row: {
          created_at: string
          discount_applied: number
          id: string
          order_id: string | null
          user_id: string
          voucher_id: string
        }
        Insert: {
          created_at?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
          user_id: string
          voucher_id: string
        }
        Update: {
          created_at?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
          user_id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_percent: number
          end_date: string
          id: string
          max_discount: number | null
          member_level: string | null
          name: string
          start_date: string
          updated_at: string
          usage_per_customer: number
          voucher_type: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_percent: number
          end_date: string
          id?: string
          max_discount?: number | null
          member_level?: string | null
          name: string
          start_date: string
          updated_at?: string
          usage_per_customer?: number
          voucher_type: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          end_date?: string
          id?: string
          max_discount?: number | null
          member_level?: string | null
          name?: string
          start_date?: string
          updated_at?: string
          usage_per_customer?: number
          voucher_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_stock: {
        Args: { _amount: number; _note?: string }
        Returns: number
      }
      admin_list_customers: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          last_login: string
          member_level: string
          registered_at: string
          status: string
          total_spent: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
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
    Enums: {
      app_role: ["admin", "customer"],
    },
  },
} as const
