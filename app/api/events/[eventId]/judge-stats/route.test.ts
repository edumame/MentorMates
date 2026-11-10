/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { cappedQuery } from "@/lib/supabase/capped-query.test-helper";

const EVENT_ID = "event-1";
const JUDGE_ID = "judge-1";

const scoreRows = Array.from({ length: 1200 }, (_, index) => ({
  judge_id: JUDGE_ID,
  project_id: `project-${index}`,
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
    getUser: async () => ({ data: { user: { id: "organizer" } }, error: null }),
  },
  from: () => singleRow({ role: "organizer" }),
  rpc: async () => ({ data: false, error: null }),
};

const serviceMock = {
  from: (table: string) => {
    if (table === "events") {
      return singleRow({ event_id: EVENT_ID, event_name: "Event" });
    }
    if (table === "project_scores") return cappedQuery(scoreRows);
    if (table === "user_event_roles") {
      return cappedQuery([
        { user_id: JUDGE_ID, role: "judge", user_profiles: null },
      ]);
    }
    return cappedQuery([]);
  },
};

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(async () => supabaseMock),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => serviceMock,
}));

import { GET } from "./route";

describe("GET /api/events/[eventId]/judge-stats", () => {
  it("counts projects judged beyond the PostgREST row cap", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/events/${EVENT_ID}/judge-stats`),
      { params: Promise.resolve({ eventId: EVENT_ID }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.judges[0].projects_judged).toBe(1200);
  });
});
