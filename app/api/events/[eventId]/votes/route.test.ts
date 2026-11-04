/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { cappedQuery } from "@/lib/supabase/capped-query.test-helper";

const VIEWER_ID = "viewer";
const EVENT_ID = "event-1";

let voteRows: { project_id: string; user_id: string }[] = [];

const supabaseMock = {
  auth: {
    getUser: async () => ({ data: { user: { id: VIEWER_ID } }, error: null }),
  },
  from: (table: string) =>
    table === "project_votes"
      ? cappedQuery(voteRows)
      : {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { role: "participant" },
                  error: null,
                }),
              }),
            }),
          }),
        },
};

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(async () => supabaseMock),
}));

import { GET } from "./route";

function getVotes() {
  return GET(new NextRequest(`http://localhost/api/events/${EVENT_ID}/votes`), {
    params: Promise.resolve({ eventId: EVENT_ID }),
  });
}

function otherVotes(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    project_id: index % 2 === 0 ? "project-a" : "project-b",
    user_id: `voter-${index}`,
  }));
}

describe("GET /api/events/[eventId]/votes", () => {
  it("counts votes beyond the PostgREST row cap, including the viewer's", async () => {
    voteRows = [
      ...otherVotes(1200),
      { project_id: "project-a", user_id: VIEWER_ID },
      { project_id: "project-b", user_id: VIEWER_ID },
      { project_id: "project-c", user_id: VIEWER_ID },
    ];

    const response = await getVotes();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.voteCounts).toEqual({
      "project-a": 601,
      "project-b": 601,
      "project-c": 1,
    });
    expect(body.userVotes).toEqual(["project-a", "project-b", "project-c"]);
    expect(body.remainingVotes).toBe(0);
  });

  it("counts exactly the votes of a small event", async () => {
    voteRows = otherVotes(4);

    const body = await (await getVotes()).json();

    expect(body.voteCounts).toEqual({ "project-a": 2, "project-b": 2 });
    expect(body.userVotes).toEqual([]);
    expect(body.remainingVotes).toBe(3);
  });
});
