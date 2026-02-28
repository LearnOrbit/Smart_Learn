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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assignment_lo_mapping: {
        Row: {
          assignment_id: string
          id: string
          learning_outcome_id: string
        }
        Insert: {
          assignment_id: string
          id?: string
          learning_outcome_id: string
        }
        Update: {
          assignment_id?: string
          id?: string
          learning_outcome_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_lo_mapping_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_lo_mapping_learning_outcome_id_fkey"
            columns: ["learning_outcome_id"]
            isOneToOne: false
            referencedRelation: "learning_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          id: string
          max_marks: number | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          max_marks?: number | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          max_marks?: number | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_outcomes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          description: string
          id: string
          program_outcome_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
          program_outcome_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          program_outcome_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_outcomes_program_outcome_id_fkey"
            columns: ["program_outcome_id"]
            isOneToOne: false
            referencedRelation: "program_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_outcomes: {
        Row: {
          code: string
          course_outcome_id: string
          created_at: string
          created_by: string
          description: string
          id: string
        }
        Insert: {
          code: string
          course_outcome_id: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
        }
        Update: {
          code?: string
          course_outcome_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_outcomes_course_outcome_id_fkey"
            columns: ["course_outcome_id"]
            isOneToOne: false
            referencedRelation: "course_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      program_outcomes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          description: string
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string
          extracted_text: string | null
          feedback: string | null
          grade: string | null
          id: string
          image_path: string | null
          marks: number | null
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          content?: string
          extracted_text?: string | null
          feedback?: string | null
          grade?: string | null
          id?: string
          image_path?: string | null
          marks?: number | null
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string
          extracted_text?: string | null
          feedback?: string | null
          grade?: string | null
          id?: string
          image_path?: string | null
          marks?: number | null
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_co_score: {
        Args: { _co_id: string; _student_id: string }
        Returns: number
      }
      calc_lo_score: {
        Args: { _lo_id: string; _student_id: string }
        Returns: number
      }
      calc_po_score: {
        Args: { _po_id: string; _student_id: string }
        Returns: number
      }
      get_student_scores: {
        Args: { _student_id: string }
        Returns: {
          co_code: string
          co_id: string
          co_score: number
          lo_code: string
          lo_id: string
          lo_score: number
          po_code: string
          po_id: string
          po_score: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
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
      app_role: "teacher" | "student"
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
      app_role: ["teacher", "student"],
    },
  },
} as const
