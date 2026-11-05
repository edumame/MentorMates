/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { cappedQuery } from "@/lib/supabase/capped-query.test-helper";

const EVENT_ID = "event-1";

const project = {
  id: "project-a",
  project_name: "Project A",
  lead_name: "Lead",
  cover_image_url: null,
};

const voteRows = Array.from({ length: 1200 }, (_, index) => ({
  id: `vote-${index}`,
  project_id: project.id,
  user_id: `voter-${index}`,
  created_at: "2026-01-01T00:00:00Z",
  projects: project,
}));

const singleRow = (data: unknown) => ({
  select: () => ({
    eq: () => ({
      eq: () => ({ maybeSingle: async () => ({ data, error: null }) }),
      single: async () => ({ data, error: null }),
    }),
  }),
});

const supabaseMock = {
  auth: {
    getUser: async () => ({ data: { user: { id: "owner" } }, error: null }),
  },
  from: (table: string) => {
    if (table === "project_votes") return cappedQuery(voteRows);
    if (table === "events") return singleRow({ owner_id: "owner" });
    return singleRow({ role: "organizer" });
  },
};

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(async () => supabaseMock),
}));

import { GET } from "./route";

describe("GET /api/events/[eventId]/votes/results", () => {
  it("totals votes beyond the PostgREST row cap", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/events/${EVENT_ID}/votes/results`),
      { params: Promise.resolve({ eventId: EVENT_ID }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalVotes).toBe(1200);
    expect(body.totalVoters).toBe(1200);
    expect(body.results[0].voteCount).toBe(1200);
  });
});
