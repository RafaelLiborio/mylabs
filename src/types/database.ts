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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      anthropometry_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          bioimpedance: Json
          circumferences: Json
          client_id: string
          created_at: string
          height_cm: number | null
          id: string
          notes: string | null
          photo_paths: string[]
          protocol: string | null
          results: Json
          skinfolds: Json
          weight_kg: number | null
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          bioimpedance?: Json
          circumferences?: Json
          client_id: string
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          photo_paths?: string[]
          protocol?: string | null
          results?: Json
          skinfolds?: Json
          weight_kg?: number | null
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          bioimpedance?: Json
          circumferences?: Json
          client_id?: string
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          photo_paths?: string[]
          protocol?: string | null
          results?: Json
          skinfolds?: Json
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anthropometry_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anthropometry_assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      clients: {
        Row: {
          activity_level: string
          birth_date: string | null
          clinical_notes: string | null
          created_at: string
          goal: string | null
          height_cm: number | null
          id: string
          nutritionist_id: string
          plan: string
          restrictions: string | null
          sex: Database["public"]["Enums"]["sex_type"] | null
          water_goal_ml: number
        }
        Insert: {
          activity_level?: string
          birth_date?: string | null
          clinical_notes?: string | null
          created_at?: string
          goal?: string | null
          height_cm?: number | null
          id: string
          nutritionist_id: string
          plan?: string
          restrictions?: string | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
          water_goal_ml?: number
        }
        Update: {
          activity_level?: string
          birth_date?: string | null
          clinical_notes?: string | null
          created_at?: string
          goal?: string | null
          height_cm?: number | null
          id?: string
          nutritionist_id?: string
          plan?: string
          restrictions?: string | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
          water_goal_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_formulas: {
        Row: {
          category: string
          created_at: string
          description: string | null
          expression: string
          id: string
          name: string
          owner_id: string
          reference: string | null
          unit: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          expression: string
          id?: string
          name: string
          owner_id?: string
          reference?: string | null
          unit?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          expression?: string
          id?: string
          name?: string
          owner_id?: string
          reference?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_formulas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_attachments: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          mime_type: string | null
          plan_id: string
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          plan_id: string
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          plan_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_attachments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_meal_items: {
        Row: {
          food_id: string
          grams: number
          id: string
          meal_id: string
          position: number
        }
        Insert: {
          food_id: string
          grams: number
          id?: string
          meal_id: string
          position?: number
        }
        Update: {
          food_id?: string
          grams?: number
          id?: string
          meal_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "diet_meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "diet_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_meals: {
        Row: {
          id: string
          meal_time: string | null
          name: string
          notes: string | null
          plan_id: string
          position: number
        }
        Insert: {
          id?: string
          meal_time?: string | null
          name: string
          notes?: string | null
          plan_id: string
          position?: number
        }
        Update: {
          id?: string
          meal_time?: string | null
          name?: string
          notes?: string | null
          plan_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "diet_meals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_plans: {
        Row: {
          active: boolean
          carb_target_g: number | null
          client_id: string
          created_at: string
          fat_target_g: number | null
          id: string
          kcal_target: number | null
          kind: string
          name: string
          notes: string | null
          nutritionist_id: string
          protein_target_g: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          carb_target_g?: number | null
          client_id: string
          created_at?: string
          fat_target_g?: number | null
          id?: string
          kcal_target?: number | null
          kind?: string
          name: string
          notes?: string | null
          nutritionist_id?: string
          protein_target_g?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          carb_target_g?: number | null
          client_id?: string
          created_at?: string
          fat_target_g?: number | null
          id?: string
          kcal_target?: number | null
          kind?: string
          name?: string
          notes?: string | null
          nutritionist_id?: string
          protein_target_g?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plans_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          equipment: string
          frame_urls: string[]
          gif_url: string | null
          id: string
          instructions_pt: string[]
          level: string
          muscle_group: string
          name_pt: string
          owner_id: string | null
          secondary_muscles: string[]
          slug: string | null
        }
        Insert: {
          created_at?: string
          equipment?: string
          frame_urls?: string[]
          gif_url?: string | null
          id?: string
          instructions_pt?: string[]
          level?: string
          muscle_group: string
          name_pt: string
          owner_id?: string | null
          secondary_muscles?: string[]
          slug?: string | null
        }
        Update: {
          created_at?: string
          equipment?: string
          frame_urls?: string[]
          gif_url?: string | null
          id?: string
          instructions_pt?: string[]
          level?: string
          muscle_group?: string
          name_pt?: string
          owner_id?: string | null
          secondary_muscles?: string[]
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          carb_g: number
          created_at: string
          fat_g: number
          fiber_g: number
          food_group: string
          id: string
          kcal: number | null
          name: string
          owner_id: string | null
          protein_g: number
          source: string
        }
        Insert: {
          carb_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          food_group: string
          id?: string
          kcal?: number | null
          name: string
          owner_id?: string | null
          protein_g?: number
          source?: string
        }
        Update: {
          carb_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          food_group?: string
          id?: string
          kcal?: number | null
          name?: string
          owner_id?: string | null
          protein_g?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_logs: {
        Row: {
          client_id: string
          completed: boolean
          created_at: string
          log_date: string
          meal_id: string
        }
        Insert: {
          client_id: string
          completed?: boolean
          created_at?: string
          log_date?: string
          meal_id: string
        }
        Update: {
          client_id?: string
          completed?: boolean
          created_at?: string
          log_date?: string
          meal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "diet_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          bio: string | null
          city_state: string | null
          clinic_name: string | null
          created_at: string
          created_by: string | null
          crn: string | null
          crn_region: string | null
          crn_status: Database["public"]["Enums"]["crn_status"]
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          role: Database["public"]["Enums"]["app_role"]
          specialty: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          city_state?: string | null
          clinic_name?: string | null
          created_at?: string
          created_by?: string | null
          crn?: string | null
          crn_region?: string | null
          crn_status?: Database["public"]["Enums"]["crn_status"]
          email?: string
          full_name?: string
          id: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          city_state?: string | null
          clinic_name?: string | null
          created_at?: string
          created_by?: string | null
          crn?: string | null
          crn_region?: string | null
          crn_status?: Database["public"]["Enums"]["crn_status"]
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          client_id: string
          enabled: boolean
          interval_days: number
          last_run_on: string | null
          next_run_on: string
          nutritionist_id: string
        }
        Insert: {
          client_id: string
          enabled?: boolean
          interval_days?: number
          last_run_on?: string | null
          next_run_on?: string
          nutritionist_id?: string
        }
        Update: {
          client_id?: string
          enabled?: boolean
          interval_days?: number
          last_run_on?: string | null
          next_run_on?: string
          nutritionist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          client_id: string
          created_at: string
          data: Json
          generated_by: string
          id: string
          nutritionist_id: string
          period_end: string
          period_start: string
          read_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          data: Json
          generated_by?: string
          id?: string
          nutritionist_id: string
          period_end: string
          period_start: string
          read_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          data?: Json
          generated_by?: string
          id?: string
          nutritionist_id?: string
          period_end?: string
          period_start?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          category: string
          created_at: string
          from_user: string
          id: string
          kind: string
          message: string
          status: string
          to_user: string | null
          whatsapp_to: string | null
        }
        Insert: {
          category: string
          created_at?: string
          from_user?: string
          id?: string
          kind: string
          message: string
          status?: string
          to_user?: string | null
          whatsapp_to?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          from_user?: string
          id?: string
          kind?: string
          message?: string
          status?: string
          to_user?: string | null
          whatsapp_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_logs: {
        Row: {
          client_id: string
          log_date: string
          ml: number
        }
        Insert: {
          client_id: string
          log_date?: string
          ml?: number
        }
        Update: {
          client_id?: string
          log_date?: string
          ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_checkins: {
        Row: {
          client_id: string
          log_date: string
          note: string | null
          weight_kg: number
        }
        Insert: {
          client_id: string
          log_date?: string
          note?: string | null
          weight_kg: number
        }
        Update: {
          client_id?: string
          log_date?: string
          note?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_checkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_days: {
        Row: {
          id: string
          muscle_groups: string[]
          notes: string | null
          plan_id: string
          title: string
          week: number
          weekday: number
        }
        Insert: {
          id?: string
          muscle_groups?: string[]
          notes?: string | null
          plan_id: string
          title: string
          week: number
          weekday: number
        }
        Update: {
          id?: string
          muscle_groups?: string[]
          notes?: string | null
          plan_id?: string
          title?: string
          week?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          day_id: string
          exercise_id: string
          id: string
          load_kg: number | null
          notes: string | null
          position: number
          reps: string
          rest_sec: number
          sets: number
        }
        Insert: {
          day_id: string
          exercise_id: string
          id?: string
          load_kg?: number | null
          notes?: string | null
          position?: number
          reps?: string
          rest_sec?: number
          sets?: number
        }
        Update: {
          day_id?: string
          exercise_id?: string
          id?: string
          load_kg?: number | null
          notes?: string | null
          position?: number
          reps?: string
          rest_sec?: number
          sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          client_id: string
          completed: boolean
          created_at: string
          id: string
          load_kg: number | null
          log_date: string
          reps: number | null
          workout_exercise_id: string
        }
        Insert: {
          client_id: string
          completed?: boolean
          created_at?: string
          id?: string
          load_kg?: number | null
          log_date?: string
          reps?: number | null
          workout_exercise_id: string
        }
        Update: {
          client_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          load_kg?: number | null
          log_date?: string
          reps?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          nutritionist_id: string
          start_date: string
          weeks: number
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          nutritionist_id?: string
          start_date?: string
          weeks?: number
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          nutritionist_id?: string
          start_date?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _build_client_report: {
        Args: { p_client: string; p_end: string; p_start: string }
        Returns: Json
      }
      can_access_client: { Args: { p_client: string }; Returns: boolean }
      can_manage_client: { Args: { p_client: string }; Returns: boolean }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      diet_meal_client: { Args: { p_meal: string }; Returns: string }
      diet_plan_client: { Args: { p_plan: string }; Returns: string }
      generate_client_report: {
        Args: { p_client: string; p_days?: number }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_client_self: { Args: { p_client: string }; Returns: boolean }
      run_due_reports: { Args: never; Returns: number }
      today_br: { Args: never; Returns: string }
      workout_day_client: { Args: { p_day: string }; Returns: string }
      workout_exercise_client: { Args: { p_we: string }; Returns: string }
      workout_plan_client: { Args: { p_plan: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "nutritionist" | "client"
      crn_status: "pending" | "approved" | "rejected"
      sex_type: "male" | "female"
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
    Enums: {
      app_role: ["admin", "nutritionist", "client"],
      crn_status: ["pending", "approved", "rejected"],
      sex_type: ["male", "female"],
    },
  },
} as const
