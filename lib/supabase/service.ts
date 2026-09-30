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

type ServiceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
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
