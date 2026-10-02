// shipcue's ReportStore over the Supabase service-role client. The app has no
// direct Postgres URL server-side, so shipcue's postgresStore (which needs a
// pg connection) cannot be used. Every write here is a single UPDATE ... WHERE
// ... RETURNING through PostgREST, so a move only happens if the row is still
// in the state it needs (open to claim, claimed to release, no video yet to
// attach one). Taking the next report is the shipcue_claim_next() SQL function,
// which locks with FOR UPDATE SKIP LOCKED so two agents never get the same one.
import type { Report, Status } from "shipcue";
import type { ReportStore } from "shipcue/server";
import type { ServiceSupabaseClient, ShipcueReportRow } from "@/lib/supabase/service";

const TABLE = "shipcue_reports";
const COLUMNS =
  "id, type, priority, area, description, page_url, user_agent, diagnostics, screenshots, reporter, status, claimed_by, claimed_at, resolution, video, context, created_at";

type Row = Pick<
  ShipcueReportRow,
  | "id"
  | "type"
  | "priority"
  | "area"
  | "description"
  | "page_url"
  | "user_agent"
  | "diagnostics"
  | "screenshots"
  | "reporter"
  | "status"
  | "claimed_by"
  | "claimed_at"
  | "resolution"
  | "video"
  | "context"
  | "created_at"
>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (v: string | null) => (v === null ? null : new Date(v).toISOString());

export function toReport(r: Row): Report {
  return {
    id: r.id,
    type: r.type,
    priority: r.priority,
    area: r.area,
    description: r.description,
    pageUrl: r.page_url,
    userAgent: r.user_agent,
    diagnostics:
      typeof r.diagnostics === "string" ? JSON.parse(r.diagnostics) : (r.diagnostics ?? {}),
    screenshots: r.screenshots ?? [],
    reporter: r.reporter,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    claimedBy: r.claimed_by,
    claimedAt: iso(r.claimed_at),
    resolution: r.resolution,
    video: r.video ?? null,
    context: r.context ?? null,
  };
}

type Result = { data: unknown; error: { message: string } | null };

function unwrap(op: string, { data, error }: Result): Row | null {
  if (error) throw new Error(`shipcue store ${op}: ${error.message}`);
  return (data as Row | null) ?? null;
}

export function supabaseStore(db: ServiceSupabaseClient): ReportStore {
  const now = () => new Date().toISOString();
  const one = (op: string, res: Result) => {
    const row = unwrap(op, res);
    return row ? toReport(row) : null;
  };

  return {
    async create(input) {
      const res = await db
        .from(TABLE)
        .insert({
          type: input.type,
          priority: input.priority,
          area: input.area,
          description: input.description,
          page_url: input.pageUrl,
          user_agent: input.userAgent,
          diagnostics: input.diagnostics,
          screenshots: input.screenshots,
          reporter: input.reporter,
          context: input.context ?? null,
        })
        .select(COLUMNS)
        .single();
      const report = one("create", res);
      if (!report) throw new Error("shipcue store create: no row returned");
      return report;
    },

    async get(id) {
      if (!UUID.test(id)) return null;
      const res = await db
        .from(TABLE)
        .select(COLUMNS)
        .eq("id", id)
        .eq("is_deleted", false)
        .maybeSingle();
      return one("get", res);
    },

    async list(filter: { status?: Status } = {}) {
      let query = db.from(TABLE).select(COLUMNS).eq("is_deleted", false);
      if (filter.status) query = query.eq("status", filter.status);
      const { data, error } = await query
        .order("priority_rank", { ascending: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw new Error(`shipcue store list: ${error.message}`);
      return ((data ?? []) as Row[]).map(toReport);
    },

    async claimNext(agent) {
      const { data, error } = await db.rpc("shipcue_claim_next", { p_agent: agent });
      if (error) throw new Error(`shipcue store claimNext: ${error.message}`);
      const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
      return row ? toReport(row) : null;
    },

    async claim(id, agent) {
      if (!UUID.test(id)) return null;
      const t = now();
      const res = await db
        .from(TABLE)
        .update({ status: "claimed", claimed_by: agent, claimed_at: t, updated_at: t })
        .eq("id", id)
        .eq("status", "open")
        .eq("is_deleted", false)
        .select(COLUMNS)
        .maybeSingle();
      return one("claim", res);
    },

    async release(id) {
      if (!UUID.test(id)) return null;
      const res = await db
        .from(TABLE)
        .update({ status: "open", claimed_by: null, claimed_at: null, updated_at: now() })
        .eq("id", id)
        .eq("status", "claimed")
        .eq("is_deleted", false)
        .select(COLUMNS)
        .maybeSingle();
      return one("release", res);
    },

    async close(id, status, resolution) {
      if (!UUID.test(id)) return null;
      const res = await db
        .from(TABLE)
        .update({ status, resolution, updated_at: now() })
        .eq("id", id)
        .eq("is_deleted", false)
        .select(COLUMNS)
        .maybeSingle();
      return one("close", res);
    },

    async attachVideo(id, url) {
      if (!UUID.test(id)) return null;
      const res = await db
        .from(TABLE)
        .update({ video: url, updated_at: now() })
        .eq("id", id)
        .is("video", null)
        .eq("is_deleted", false)
        .select(COLUMNS)
        .maybeSingle();
      return one("attachVideo", res);
    },
  };
}
