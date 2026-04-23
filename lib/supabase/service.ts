import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

type ServiceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      participant_approval_requests: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          requested_role: string;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          reason: string | null;
          rejection_reason: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          requested_role: string;
          status: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reason?: string | null;
          rejection_reason?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          requested_role?: string;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reason?: string | null;
          rejection_reason?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      event_intake_form_bindings: {
        Row: {
          id: string;
          event_id: string;
          form_version_id: string | null;
          context: string;
          is_active: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          form_version_id?: string | null;
          context: string;
          is_active?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          form_version_id?: string | null;
          context?: string;
          is_active?: boolean;
          created_at?: string | null;
        };
        Relationships: [];
      };
      mentor_availability: {
        Row: {
          id: string;
          mentor_id: string;
          event_id: string;
          start_time: string;
          end_time: string;
          max_bookings: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          mentor_id: string;
          event_id: string;
          start_time: string;
          end_time: string;
          max_bookings?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          mentor_id?: string;
          event_id?: string;
          start_time?: string;
          end_time?: string;
          max_bookings?: number;
          created_at?: string | null;
        };
        Relationships: [];
      };
      mentor_bookings: {
        Row: {
          id: string;
          availability_id: string;
          participant_id: string;
          status: string;
          booked_at: string | null;
        };
        Insert: {
          id?: string;
          availability_id: string;
          participant_id: string;
          status?: string;
          booked_at?: string | null;
        };
        Update: {
          id?: string;
          availability_id?: string;
          participant_id?: string;
          status?: string;
          booked_at?: string | null;
        };
        Relationships: [];
      };
      intake_form_submissions: {
        Row: {
          id: string;
          event_id: string;
          form_version_id: string | null;
          project_id: string | null;
          submitter_user_id: string;
          context: string;
          status: string;
          submitted_at: string | null;
          created_at: string | null;
          answers: Json | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          form_version_id?: string | null;
          project_id?: string | null;
          submitter_user_id: string;
          context: string;
          status: string;
          submitted_at?: string | null;
          created_at?: string | null;
          answers?: Json | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          form_version_id?: string | null;
          project_id?: string | null;
          submitter_user_id?: string;
          context?: string;
          status?: string;
          submitted_at?: string | null;
          created_at?: string | null;
          answers?: Json | null;
        };
        Relationships: [];
      };
    };
  };
};

export type ServiceSupabaseClient = SupabaseClient<ServiceDatabase>;

export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
