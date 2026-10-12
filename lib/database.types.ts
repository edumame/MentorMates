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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      internal_api_usage: {
        Row: {
          completion_tokens: number | null
          created_at: string
          id: number
          invite_id: string | null
          key_id: string | null
          latency_ms: number | null
          prompt_tokens: number | null
          service: string
          status: number | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          id?: number
          invite_id?: string | null
          key_id?: string | null
          latency_ms?: number | null
          prompt_tokens?: number | null
          service: string
          status?: number | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          id?: number
          invite_id?: string | null
          key_id?: string | null
          latency_ms?: number | null
          prompt_tokens?: number | null
          service?: string
          status?: number | null
        }
        Relationships: []
      }
      internal_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          max_uses: number | null
          revoked_at: string | null
          service: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number | null
          revoked_at?: string | null
          service?: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number | null
          revoked_at?: string | null
          service?: string
          uses?: number
        }
        Relationships: []
      }
      agent_api_keys: {
        Row: {
          created_at: string | null
          event_id: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          scopes: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_keys_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "agent_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      agent_events: {
        Row: {
          agent_id: string
          agent_name: string | null
          created_at: string | null
          event_id: string
          event_name: string | null
        }
        Insert: {
          agent_id: string
          agent_name?: string | null
          created_at?: string | null
          event_id: string
          event_name?: string | null
        }
        Update: {
          agent_id?: string
          agent_name?: string | null
          created_at?: string | null
          event_id?: string
          event_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          enabled: boolean | null
          event_id: string | null
          feedback_prompt: string | null
          id: string
          instructions: string | null
          name: string | null
          requires_project: boolean | null
          scoring: boolean | null
          type: string
          updated_at: string | null
          user_id: string | null
          voice: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          event_id?: string | null
          feedback_prompt?: string | null
          id?: string
          instructions?: string | null
          name?: string | null
          requires_project?: boolean | null
          scoring?: boolean | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          voice?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          event_id?: string | null
          feedback_prompt?: string | null
          id?: string
          instructions?: string | null
          name?: string | null
          requires_project?: boolean | null
          scoring?: boolean | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      coupons: {
        Row: {
          amount_off: number | null
          created_at: string | null
          created_by_user_id: string | null
          currency: string | null
          duration: string
          duration_in_months: number | null
          event_id: string
          id: string
          max_redemptions: number | null
          name: string
          percent_off: number | null
          redeem_by: string | null
          status: Database["public"]["Enums"]["coupon_status_enum"]
          stripe_coupon_id: string
          updated_at: string | null
        }
        Insert: {
          amount_off?: number | null
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          duration: string
          duration_in_months?: number | null
          event_id: string
          id?: string
          max_redemptions?: number | null
          name: string
          percent_off?: number | null
          redeem_by?: string | null
          status?: Database["public"]["Enums"]["coupon_status_enum"]
          stripe_coupon_id: string
          updated_at?: string | null
        }
        Update: {
          amount_off?: number | null
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          duration?: string
          duration_in_months?: number | null
          event_id?: string
          id?: string
          max_redemptions?: number | null
          name?: string
          percent_off?: number | null
          redeem_by?: string | null
          status?: Database["public"]["Enums"]["coupon_status_enum"]
          stripe_coupon_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "coupons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_approval_logs: {
        Row: {
          admin_user_id: string
          created_at: string
          event_id: string
          log_id: string
          new_status: Database["public"]["Enums"]["approval_status"]
          notes: string | null
          previous_status: Database["public"]["Enums"]["approval_status"] | null
          rejection_reason: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          event_id: string
          log_id?: string
          new_status: Database["public"]["Enums"]["approval_status"]
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          rejection_reason?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          event_id?: string
          log_id?: string
          new_status?: Database["public"]["Enums"]["approval_status"]
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_approval_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "event_approval_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_intake_form_bindings: {
        Row: {
          context: Database["public"]["Enums"]["intake_form_context"]
          created_at: string
          created_by: string
          event_id: string
          form_version_id: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          context: Database["public"]["Enums"]["intake_form_context"]
          created_at?: string
          created_by: string
          event_id: string
          form_version_id: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          context?: Database["public"]["Enums"]["intake_form_context"]
          created_at?: string
          created_by?: string
          event_id?: string
          form_version_id?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_intake_form_bindings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "event_intake_form_bindings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_intake_form_bindings_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "intake_form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_lessons: {
        Row: {
          cover_image_url: string
          created_at: string
          description: string
          duration_minutes: number
          event_id: string
          id: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          cover_image_url: string
          created_at?: string
          description: string
          duration_minutes: number
          event_id: string
          id?: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          cover_image_url?: string
          created_at?: string
          description?: string
          duration_minutes?: number
          event_id?: string
          id?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_lessons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_submission_fields: {
        Row: {
          allows_multiple_entries: boolean
          created_at: string
          description: string | null
          event_id: string
          field_type: Database["public"]["Enums"]["submission_field_type"]
          id: string
          is_active: boolean
          key: string
          label: string
          max_files: number | null
          options: Json
          placeholder: string | null
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          allows_multiple_entries?: boolean
          created_at?: string
          description?: string | null
          event_id: string
          field_type?: Database["public"]["Enums"]["submission_field_type"]
          id?: string
          is_active?: boolean
          key: string
          label: string
          max_files?: number | null
          options?: Json
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allows_multiple_entries?: boolean
          created_at?: string
          description?: string | null
          event_id?: string
          field_type?: Database["public"]["Enums"]["submission_field_type"]
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          max_files?: number | null
          options?: Json
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_submission_fields_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_tickets: {
        Row: {
          assigned_at: string | null
          assigned_to_email: string | null
          assigned_to_user_id: string | null
          created_at: string | null
          event_id: string
          id: string
          payment_id: string
          purchased_by_user_id: string
          ticket_status:
            | Database["public"]["Enums"]["ticket_status_enum"]
            | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to_email?: string | null
          assigned_to_user_id?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          payment_id: string
          purchased_by_user_id: string
          ticket_status?:
            | Database["public"]["Enums"]["ticket_status_enum"]
            | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to_email?: string | null
          assigned_to_user_id?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          payment_id?: string
          purchased_by_user_id?: string
          ticket_status?:
            | Database["public"]["Enums"]["ticket_status_enum"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_tickets_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "event_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_tickets_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "user_event_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tickets_purchased_by_user_id_fkey"
            columns: ["purchased_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      event_tracks: {
        Row: {
          created_at: string | null
          description: string | null
          event_id: string
          label: string | null
          name: string
          prize_amount: string | null
          prize_description: string | null
          scoring_criteria: Json | null
          track_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_id: string
          label?: string | null
          name: string
          prize_amount?: string | null
          prize_description?: string | null
          scoring_criteria?: Json | null
          track_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_id?: string
          label?: string | null
          name?: string
          prize_amount?: string | null
          prize_description?: string | null
          scoring_criteria?: Json | null
          track_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_tracks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      events: {
        Row: {
          max_projects: number | null

          approval_status: Database["public"]["Enums"]["approval_status"] | null
          cover_image_url: string | null
          created_at: string | null
          event_blurb: string | null
          event_date: string
          event_description: string | null
          event_id: string
          event_name: string
          event_prizes: Json | null
          event_resources: Json | null
          event_schedule: Json
          event_type: string[]
          expected_attendance: number | null
          external_redirect_enabled: boolean
          external_url: string | null
          faq: Json | null
          featured: boolean | null
          featured_requested: boolean
          finalist_recommendation_enabled: boolean | null
          location: string | null
          organizer_affiliation: string | null
          owner_id: string | null
          paid: boolean | null
          participant_capacity: number | null
          paywall_content: string | null
          price: number | null
          rejection_reason: string | null
          require_participant_approval: boolean | null
          role_labels: Json | null
          rules: Json
          scoring_config: Json | null
          session_caps: Json | null
          slug: string | null
          sponsorship_tiers: Json | null
          stripe_price_id: string | null
          submission_time_cutoff: string | null
          submission_time_start: string | null
          submitter_email: string | null
          submitter_name: string | null
          team_formation_enabled: boolean
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          max_projects?: number | null

          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          cover_image_url?: string | null
          created_at?: string | null
          event_blurb?: string | null
          event_date: string
          event_description?: string | null
          event_id?: string
          event_name: string
          event_prizes?: Json | null
          event_resources?: Json | null
          event_schedule?: Json
          event_type?: string[]
          expected_attendance?: number | null
          external_redirect_enabled?: boolean
          external_url?: string | null
          faq?: Json | null
          featured?: boolean | null
          featured_requested?: boolean
          finalist_recommendation_enabled?: boolean | null
          location?: string | null
          organizer_affiliation?: string | null
          owner_id?: string | null
          paid?: boolean | null
          participant_capacity?: number | null
          paywall_content?: string | null
          price?: number | null
          rejection_reason?: string | null
          require_participant_approval?: boolean | null
          role_labels?: Json | null
          rules: Json
          scoring_config?: Json | null
          session_caps?: Json | null
          slug?: string | null
          sponsorship_tiers?: Json | null
          stripe_price_id?: string | null
          submission_time_cutoff?: string | null
          submission_time_start?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          team_formation_enabled?: boolean
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          max_projects?: number | null

          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          cover_image_url?: string | null
          created_at?: string | null
          event_blurb?: string | null
          event_date?: string
          event_description?: string | null
          event_id?: string
          event_name?: string
          event_prizes?: Json | null
          event_resources?: Json | null
          event_schedule?: Json
          event_type?: string[]
          expected_attendance?: number | null
          external_redirect_enabled?: boolean
          external_url?: string | null
          faq?: Json | null
          featured?: boolean | null
          featured_requested?: boolean
          finalist_recommendation_enabled?: boolean | null
          location?: string | null
          organizer_affiliation?: string | null
          owner_id?: string | null
          paid?: boolean | null
          participant_capacity?: number | null
          paywall_content?: string | null
          price?: number | null
          rejection_reason?: string | null
          require_participant_approval?: boolean | null
          role_labels?: Json | null
          rules?: Json
          scoring_config?: Json | null
          session_caps?: Json | null
          slug?: string | null
          sponsorship_tiers?: Json | null
          stripe_price_id?: string | null
          submission_time_cutoff?: string | null
          submission_time_start?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          team_formation_enabled?: boolean
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      feedback: {
        Row: {
          actionable_ai_suggestion: string | null
          created_at: string | null
          event_id: string | null
          feedback_text: string | null
          id: string
          mentor_email: string | null
          mentor_id: string | null
          mentor_name: string | null
          modifier_field: string[] | null
          original_feedback_text: string | null
          positive_ai_suggestion: string | null
          project_id: string | null
          specific_ai_suggestion: string | null
        }
        Insert: {
          actionable_ai_suggestion?: string | null
          created_at?: string | null
          event_id?: string | null
          feedback_text?: string | null
          id?: string
          mentor_email?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          modifier_field?: string[] | null
          original_feedback_text?: string | null
          positive_ai_suggestion?: string | null
          project_id?: string | null
          specific_ai_suggestion?: string | null
        }
        Update: {
          actionable_ai_suggestion?: string | null
          created_at?: string | null
          event_id?: string | null
          feedback_text?: string | null
          id?: string
          mentor_email?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          modifier_field?: string[] | null
          original_feedback_text?: string | null
          positive_ai_suggestion?: string | null
          project_id?: string | null
          specific_ai_suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_read_status: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_read_status_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_form_submission_answers: {
        Row: {
          created_at: string
          field_key: string
          form_version_id: string
          id: string
          submission_id: string
          updated_at: string
          value_json: Json
        }
        Insert: {
          created_at?: string
          field_key: string
          form_version_id: string
          id?: string
          submission_id: string
          updated_at?: string
          value_json: Json
        }
        Update: {
          created_at?: string
          field_key?: string
          form_version_id?: string
          id?: string
          submission_id?: string
          updated_at?: string
          value_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_submission_answers_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "intake_form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_submission_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "intake_form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_form_submissions: {
        Row: {
          context: Database["public"]["Enums"]["intake_form_context"]
          created_at: string
          event_id: string
          form_version_id: string
          id: string
          project_id: string | null
          status: Database["public"]["Enums"]["intake_form_submission_status"]
          submitted_at: string | null
          submitter_user_id: string
          updated_at: string
        }
        Insert: {
          context: Database["public"]["Enums"]["intake_form_context"]
          created_at?: string
          event_id: string
          form_version_id: string
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["intake_form_submission_status"]
          submitted_at?: string | null
          submitter_user_id: string
          updated_at?: string
        }
        Update: {
          context?: Database["public"]["Enums"]["intake_form_context"]
          created_at?: string
          event_id?: string
          form_version_id?: string
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["intake_form_submission_status"]
          submitted_at?: string | null
          submitter_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "intake_form_submissions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "intake_form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_submissions_submitter_user_id_fkey"
            columns: ["submitter_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      intake_form_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_id: string
          id: string
          name: string
          status: Database["public"]["Enums"]["intake_form_template_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["intake_form_template_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["intake_form_template_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "intake_form_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      intake_form_versions: {
        Row: {
          created_at: string
          created_by: string
          form_template_id: string
          id: string
          published_at: string | null
          schema_json: Json
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          form_template_id: string
          id?: string
          published_at?: string | null
          schema_json: Json
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          form_template_id?: string
          id?: string
          published_at?: string | null
          schema_json?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "intake_form_versions_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "intake_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_screen_context: {
        Row: {
          last_frame_ts: string | null
          meeting_id: string
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          last_frame_ts?: string | null
          meeting_id: string
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          last_frame_ts?: string | null
          meeting_id?: string
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          agent_id: string | null
          category_scores: Json | null
          created_at: string | null
          ended_at: string | null
          event_id: string | null
          id: string
          name: string | null
          project_id: string | null
          recording_url: string | null
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["meeting_status"] | null
          summary: string | null
          transcript_url: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          category_scores?: Json | null
          created_at?: string | null
          ended_at?: string | null
          event_id?: string | null
          id?: string
          name?: string | null
          project_id?: string | null
          recording_url?: string | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"] | null
          summary?: string | null
          transcript_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          category_scores?: Json | null
          created_at?: string | null
          ended_at?: string | null
          event_id?: string | null
          id?: string
          name?: string | null
          project_id?: string | null
          recording_url?: string | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"] | null
          summary?: string | null
          transcript_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_availability: {
        Row: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          max_bookings: number
          mentor_id: string
          start_time: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          event_id: string
          id?: string
          max_bookings?: number
          mentor_id: string
          start_time: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          event_id?: string
          id?: string
          max_bookings?: number
          mentor_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_availability_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "mentor_availability_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      mentor_bookings: {
        Row: {
          availability_id: string
          booked_at: string | null
          id: string
          participant_id: string
          status: string
        }
        Insert: {
          availability_id: string
          booked_at?: string | null
          id?: string
          participant_id: string
          status?: string
        }
        Update: {
          availability_id?: string
          booked_at?: string | null
          id?: string
          participant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_bookings_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "mentor_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_bookings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      participant_approval_requests: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["event_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["participant_request_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["event_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["participant_request_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["event_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["participant_request_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_approval_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "participant_approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "participant_approval_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      platform_engagement: {
        Row: {
          content: string
          created_at: string | null
          display_name: string | null
          event_id: string
          id: string
          is_private: boolean | null
          status: string | null
          tags: string[] | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          display_name?: string | null
          event_id: string
          id?: string
          is_private?: boolean | null
          status?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          display_name?: string | null
          event_id?: string
          id?: string
          is_private?: boolean | null
          status?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_engagement_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          available_until: string | null
          bundle_size: number | null
          created_at: string | null
          currency: string
          current_quantity: number | null
          description: string | null
          event_id: string
          id: string
          is_active: boolean | null
          max_quantity: number | null
          name: string
          price: number
          sort_order: number | null
          stripe_price_id: string
          tier_id: string
          updated_at: string | null
        }
        Insert: {
          available_until?: string | null
          bundle_size?: number | null
          created_at?: string | null
          currency?: string
          current_quantity?: number | null
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          name: string
          price: number
          sort_order?: number | null
          stripe_price_id: string
          tier_id: string
          updated_at?: string | null
        }
        Update: {
          available_until?: string | null
          bundle_size?: number | null
          created_at?: string | null
          currency?: string
          current_quantity?: number | null
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          name?: string
          price?: number
          sort_order?: number | null
          stripe_price_id?: string
          tier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      prize_winners: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          prize_id: string | null
          project_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          prize_id?: string | null
          project_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          prize_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_winners_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "prize_winners_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_winners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      prizes: {
        Row: {
          created_at: string | null
          id: string
          prize_amount: string
          prize_description: string
          track_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prize_amount: string
          prize_description: string
          track_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prize_amount?: string
          prize_description?: string
          track_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prizes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "event_tracks"
            referencedColumns: ["track_id"]
          },
        ]
      }
      project_artifacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          kind: Database["public"]["Enums"]["project_artifact_kind"]
          label: string
          metadata: Json | null
          project_id: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          kind: Database["public"]["Enums"]["project_artifact_kind"]
          label: string
          metadata?: Json | null
          project_id: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["project_artifact_kind"]
          label?: string
          metadata?: Json | null
          project_id?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["event_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["event_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["event_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      project_field_entries: {
        Row: {
          content: Json
          created_at: string
          event_submission_field_id: string
          id: string
          project_id: string
          submitter_user_id: string
          updated_at: string
        }
        Insert: {
          content: Json
          created_at?: string
          event_submission_field_id: string
          id?: string
          project_id: string
          submitter_user_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          event_submission_field_id?: string
          id?: string
          project_id?: string
          submitter_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_field_entries_event_submission_field_id_fkey"
            columns: ["event_submission_field_id"]
            isOneToOne: false
            referencedRelation: "event_submission_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_field_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_field_entries_submitter_user_id_fkey"
            columns: ["submitter_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      project_likes: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_round_advancements: {
        Row: {
          advanced_at: string
          event_id: string
          id: string
          project_id: string
          round_number: number
        }
        Insert: {
          advanced_at?: string
          event_id: string
          id?: string
          project_id: string
          round_number: number
        }
        Update: {
          advanced_at?: string
          event_id?: string
          id?: string
          project_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_round_advancements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "project_round_advancements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_scores: {
        Row: {
          comments: string | null
          created_at: string | null
          event_id: string | null
          finalist_recommendation: boolean | null
          id: string
          judge_id: string
          project_id: string
          round_number: number
          scores: Json
          track_id: string | null
          updated_at: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          event_id?: string | null
          finalist_recommendation?: boolean | null
          id?: string
          judge_id: string
          project_id: string
          round_number?: number
          scores: Json
          track_id?: string | null
          updated_at?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          event_id?: string | null
          finalist_recommendation?: boolean | null
          id?: string
          judge_id?: string
          project_id?: string
          round_number?: number
          scores?: Json
          track_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_project_scores_track"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "event_tracks"
            referencedColumns: ["track_id"]
          },
          {
            foreignKeyName: "project_scores_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_submission_answers: {
        Row: {
          answer: Json
          created_at: string
          event_submission_field_id: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          answer: Json
          created_at?: string
          event_submission_field_id: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          answer?: Json
          created_at?: string
          event_submission_field_id?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_submission_answers_event_submission_field_id_fkey"
            columns: ["event_submission_field_id"]
            isOneToOne: false
            referencedRelation: "event_submission_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submission_answers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tracks: {
        Row: {
          created_at: string | null
          project_id: string
          track_id: string
        }
        Insert: {
          created_at?: string | null
          project_id: string
          track_id: string
        }
        Update: {
          created_at?: string | null
          project_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tracks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "event_tracks"
            referencedColumns: ["track_id"]
          },
        ]
      }
      project_votes: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "project_votes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          additional_materials_url: string | null
          contextus_project_id: string | null
          cover_image_url: string | null
          created_at: string | null
          event_id: string | null
          id: string
          lead_email: string | null
          lead_name: string
          private: boolean
          project_description: string | null
          project_name: string | null
          project_url: string | null
          submitted: boolean | null
          submitted_at: string | null
          teammates: string[] | null
          video_url: string | null
        }
        Insert: {
          additional_materials_url?: string | null
          contextus_project_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          lead_email?: string | null
          lead_name: string
          private?: boolean
          project_description?: string | null
          project_name?: string | null
          project_url?: string | null
          submitted?: boolean | null
          submitted_at?: string | null
          teammates?: string[] | null
          video_url?: string | null
        }
        Update: {
          additional_materials_url?: string | null
          contextus_project_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string
          private?: boolean
          project_description?: string | null
          project_name?: string | null
          project_url?: string | null
          submitted?: boolean | null
          submitted_at?: string | null
          teammates?: string[] | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          coupon_id: string
          created_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          code: string
          coupon_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          code?: string
          coupon_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons_with_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      role_passwords: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          password_hash: string
          role: Database["public"]["Enums"]["event_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          password_hash: string
          role: Database["public"]["Enums"]["event_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          password_hash?: string
          role?: Database["public"]["Enums"]["event_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_passwords_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
      system_prompts: {
        Row: {
          agent_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          prompt_text: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          prompt_text: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          prompt_text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          event_id: string
          id: string
          joined_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string | null
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_id: string
          id: string
          name: string
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_id: string
          id?: string
          name: string
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_id?: string
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_event_payments: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          event_id: string
          id: string
          is_bundle: boolean | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pricing_id: string | null
          stripe_customer_id: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tickets_quantity: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          event_id: string
          id?: string
          is_bundle?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pricing_id?: string | null
          stripe_customer_id: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tickets_quantity?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          event_id?: string
          id?: string
          is_bundle?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pricing_id?: string | null
          stripe_customer_id?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tickets_quantity?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "user_event_payments_pricing_id_fkey"
            columns: ["pricing_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_event_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_event_roles: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          role: Database["public"]["Enums"]["event_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          role: Database["public"]["Enums"]["event_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          role?: Database["public"]["Enums"]["event_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_event_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "user_event_roles_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_phone_numbers: {
        Row: {
          created_at: string
          id: string
          phone_number: string
          updated_at: string
          user_id: string
          verification_state: string | null
          verification_status: Database["public"]["Enums"]["phone_verification_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number: string
          updated_at?: string
          user_id: string
          verification_state?: string | null
          verification_status?: Database["public"]["Enums"]["phone_verification_status"]
        }
        Update: {
          created_at?: string
          id?: string
          phone_number?: string
          updated_at?: string
          user_id?: string
          verification_state?: string | null
          verification_status?: Database["public"]["Enums"]["phone_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "user_phone_numbers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_profiles: {
        Row: {
          affiliation: string | null
          avatar: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          links: Json | null
          onboarding_metadata: Json | null
          pulse: number
          stripe_customer_id: string | null
          uid: string
        }
        Insert: {
          affiliation?: string | null
          avatar?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          links?: Json | null
          onboarding_metadata?: Json | null
          pulse?: number
          stripe_customer_id?: string | null
          uid: string
        }
        Update: {
          affiliation?: string | null
          avatar?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          links?: Json | null
          onboarding_metadata?: Json | null
          pulse?: number
          stripe_customer_id?: string | null
          uid?: string
        }
        Relationships: []
      }
    }
    Views: {
      coupons_with_codes: {
        Row: {
          amount_off: number | null
          created_at: string | null
          created_by_user_id: string | null
          currency: string | null
          duration: string | null
          duration_in_months: number | null
          event_id: string | null
          id: string | null
          max_redemptions: number | null
          name: string | null
          percent_off: number | null
          promo_codes: Json | null
          redeem_by: string | null
          status: Database["public"]["Enums"]["coupon_status_enum"] | null
          stripe_coupon_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "coupons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
        ]
      }
    }
    Functions: {
      increment_internal_invite_uses: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      can_view_feedback: {
        Args: { p_feedback_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_project: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_project_tracks: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      create_auto_conversations_for_event_role: {
        Args: {
          p_event_id: string
          p_role: Database["public"]["Enums"]["event_role"]
          p_user_id: string
        }
        Returns: number
      }
      increment_promo_code_usage: {
        Args: { promo_code_text: string }
        Returns: boolean
      }
      increment_pulse: { Args: { userId: string }; Returns: undefined }
      insert: {
        Args: {
          display_name: string
          email: string
          full_name: string
          uid: string
        }
        Returns: undefined
      }
      is_admin_user: { Args: { user_id: string }; Returns: boolean }
      is_event_judge: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_judge_or_organizer: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_organizer: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_organizer_or_owner: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_feedback_public: { Args: { p_feedback_id: string }; Returns: boolean }
      is_project_event_organizer: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_public: { Args: { p_project_id: string }; Returns: boolean }
      is_track_event_organizer: {
        Args: { p_track_id: string; p_user_id: string }
        Returns: boolean
      }
      migrate_tracks_data: { Args: never; Returns: undefined }
      update_expired_coupons: { Args: never; Returns: undefined }
      user_has_event_role: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_type: "brainstorm" | "product" | "tech" | "judge" | "custom"
      approval_status: "not_submitted" | "submitted" | "approved" | "rejected"
      coupon_status_enum: "active" | "inactive" | "expired"
      event_role:
        | "participant"
        | "mentor"
        | "judge"
        | "organizer"
        | "admin"
        | "event"
      event_visibility:
        | "test"
        | "demo"
        | "private"
        | "public"
        | "draft"
        | "archived"
      intake_form_context:
        | "registration"
        | "project_submission"
        | "rsvp"
        | "post_survey"
      intake_form_submission_status: "draft" | "submitted" | "withdrawn"
      intake_form_template_status: "draft" | "published" | "archived"
      meeting_status:
        | "upcoming"
        | "active"
        | "completed"
        | "processing"
        | "cancelled"
      participant_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "withdrawn"
      payment_status: "processing" | "paid" | "canceled" | "refunded"
      phone_verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "failed"
        | "expired"
      project_artifact_kind:
        | "project_link"
        | "video_link"
        | "additional_material"
      submission_field_type:
        | "short_text"
        | "long_text"
        | "url"
        | "multi_url"
        | "file"
        | "select"
        | "multi_select"
        | "checkbox"
        | "multi_file"
      ticket_status_enum: "unassigned" | "assigned" | "used" | "transferred"
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
      agent_type: ["brainstorm", "product", "tech", "judge", "custom"],
      approval_status: ["not_submitted", "submitted", "approved", "rejected"],
      coupon_status_enum: ["active", "inactive", "expired"],
      event_role: [
        "participant",
        "mentor",
        "judge",
        "organizer",
        "admin",
        "event",
      ],
      event_visibility: [
        "test",
        "demo",
        "private",
        "public",
        "draft",
        "archived",
      ],
      intake_form_context: [
        "registration",
        "project_submission",
        "rsvp",
        "post_survey",
      ],
      intake_form_submission_status: ["draft", "submitted", "withdrawn"],
      intake_form_template_status: ["draft", "published", "archived"],
      meeting_status: [
        "upcoming",
        "active",
        "completed",
        "processing",
        "cancelled",
      ],
      participant_request_status: [
        "pending",
        "approved",
        "rejected",
        "withdrawn",
      ],
      payment_status: ["processing", "paid", "canceled", "refunded"],
      phone_verification_status: [
        "unverified",
        "pending",
        "verified",
        "failed",
        "expired",
      ],
      project_artifact_kind: [
        "project_link",
        "video_link",
        "additional_material",
      ],
      submission_field_type: [
        "short_text",
        "long_text",
        "url",
        "multi_url",
        "file",
        "select",
        "multi_select",
        "checkbox",
        "multi_file",
      ],
      ticket_status_enum: ["unassigned", "assigned", "used", "transferred"],
    },
  },
} as const
