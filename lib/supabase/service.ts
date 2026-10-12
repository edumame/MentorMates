import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Tables that exist in the database but are missing from the generated
// Database types. Additive only: existing tables keep their generated types.
type BugReportRow = {
  id: string;
  reporter_id: string | null;
  reporter_email: string | null;
  type: string;
  priority: string;
  category: string;
  title: string;
  description: string;
  page_url: string | null;
  user_agent: string | null;
  screenshot_urls: string[];
  status: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
};

// shipcue's queue table (supabase/migrations/20261001_create_shipcue_reports.sql).
export type ShipcueReportRow = {
  id: string;
  type: "bug" | "feature" | "task";
  priority: "low" | "medium" | "high" | "blocking";
  priority_rank: number;
  area: string;
  description: string;
  page_url: string;
  user_agent: string;
  diagnostics: Record<string, unknown>;
  screenshots: string[];
  reporter: string | null;
  status: "open" | "claimed" | "fixed" | "wontfix";
  claimed_by: string | null;
  claimed_at: string | null;
  resolution: string | null;
  video: string | null;
  context: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
};

type ServiceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      shipcue_claim_next: {
        Args: { p_agent: string };
        Returns: ShipcueReportRow[];
      };
    };
    Tables: Database["public"]["Tables"] & {
      shipcue_reports: {
        Row: ShipcueReportRow;
        Insert: Partial<Omit<ShipcueReportRow, "priority_rank">> &
          Pick<ShipcueReportRow, "type" | "priority" | "area" | "description">;
        Update: Partial<Omit<ShipcueReportRow, "id" | "priority_rank">>;
        Relationships: [];
      };
      bug_reports: {
        Row: BugReportRow;
        Insert: Partial<BugReportRow> &
          Pick<BugReportRow, "type" | "priority" | "category" | "title" | "description">;
        Update: Partial<BugReportRow>;
        Relationships: [];
      };
    };
  };
};

export type ServiceSupabaseClient = SupabaseClient<ServiceDatabase>;

export function createSupabaseServiceClient(): ServiceSupabaseClient {
  return createClient<ServiceDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
