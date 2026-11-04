/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { applyDraftPatch, draftToCreatePayload, emptyDraft } from "@/lib/events/chat-draft";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(() => {
    throw new Error("service client should not be needed");
  }),
}));

jest.mock("@/lib/events/invite-emails", () => ({
  sendEventInviteEmails: jest.fn().mockResolvedValue({ deferred: true }),
  sendOrganizerInviteEmails: jest.fn().mockResolvedValue({ sent: [], failed: [] }),
}));

function supabaseWith({ insertError = null }: { insertError?: { message: string; code?: string } | null } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const upserts: Record<string, unknown>[] = [];
  const from = jest.fn((table: string) => {
    if (table === "events") {
      return {
        insert: jest.fn((row: Record<string, unknown>) => {
          inserted.push(row);
          return {
            select: () => ({
              single: async () =>
                insertError
                  ? { data: null, error: insertError }
                  : { data: { event_id: "event-1", ...row }, error: null },
            }),
          };
        }),
      };
    }
    if (table === "user_event_roles") {
      return {
        upsert: jest.fn(async (row: Record<string, unknown>) => {
          upserts.push(row);
          return { error: null };
        }),
      };
    }
    if (table === "user_profiles") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "Chinat" } }) }) }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "c@x.test" } }, error: null }),
    },
    from,
  });
  return { inserted, upserts };
}

const request = (body: unknown) =>
  new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const chatPayload = () =>
  draftToCreatePayload(
    applyDraftPatch(emptyDraft("America/Los_Angeles"), {
      event_name: "BUILD NEXT@Stanford",
      start: "2026-11-06T15:30",
      end: "2026-11-06T17:30",
      location: "Stanford University",
      hosts: "Plug and Play, VLight",
      require_participant_approval: true,
      slug: "build-next-stanford",
      schedule: [{ day: "Friday, Nov 6", items: [{ time: "3:30 PM", name: "Check-in" }] }],
    })
  );

describe("POST /api/events", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates the chat's draft as a draft event and makes the creator its organizer", async () => {
    const { inserted, upserts } = supabaseWith();
    const res = await POST(request(chatPayload()));
    expect(res.status).toBe(201);
    expect(inserted[0]).toMatchObject({
      event_name: "BUILD NEXT@Stanford",
      event_date: "2026-11-06T23:30:00.000Z",
      slug: "build-next-stanford",
      visibility: "draft",
      owner_id: "user-1",
      approval_status: "not_submitted",
      featured: false,
      require_participant_approval: true,
      organizer_affiliation: "Plug and Play, VLight",
      submission_time_start: "2026-11-06T23:30:00.000Z",
      submission_time_cutoff: "2026-11-07T01:30:00.000Z",
      event_schedule: [{ time: "Friday, Nov 6", events: [{ time: "3:30 PM", name: "Check-in" }] }],
    });
    expect(upserts[0]).toMatchObject({ user_id: "user-1", event_id: "event-1", role: "organizer" });
    // No co-organizers: the service role key is never touched.
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("does not look anyone up when the only organizer email is the creator's", async () => {
    supabaseWith();
    const res = await POST(request({ ...chatPayload(), organizerEmails: ["C@x.test"] }));
    expect(res.status).toBe(201);
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("explains a taken slug", async () => {
    supabaseWith({ insertError: { message: 'duplicate key value violates unique constraint "events_slug_key"' } });
    const res = await POST(request(chatPayload()));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/slug already exists/);
  });

  it("validates with the shared create schema", async () => {
    const { inserted } = supabaseWith();
    const bad = chatPayload();
    bad.event.slug = "../admin";
    const res = await POST(request(bad));
    expect(res.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it("needs a signed-in user", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });
    expect((await POST(request(chatPayload()))).status).toBe(401);
  });

  it("ignores moderation fields sent by the client", async () => {
    const { inserted } = supabaseWith();
    const payload = chatPayload();
    const res = await POST(
      request({ ...payload, event: { ...payload.event, featured: true, approval_status: "approved" } })
    );
    expect(res.status).toBe(201);
    expect(inserted[0]).toMatchObject({ featured: false, approval_status: "not_submitted" });
  });
});
