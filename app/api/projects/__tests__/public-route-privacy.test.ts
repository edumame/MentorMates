/** @jest-environment node */
import { NextRequest } from "next/server";

type Result = { data: unknown; error: unknown };
const tables: Record<string, Result> = {};
const profileRows: Result = { data: [], error: null };
const serviceProjects: Result = { data: [], error: null };
const mockGetUser = jest.fn();
// project_team_emails result for the signed-in caller (empty = not allowed).
let teamEmailRows: unknown[] = [];
const mockRpc = jest.fn(async () => ({ data: teamEmailRows, error: null }));

// Minimal chainable PostgREST builder: every filter returns itself; awaiting
// it (also after .single/.maybeSingle/.overrideTypes) resolves to the configured table result.
function builder(result: () => Result) {
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: Result) => unknown) => resolve(result());
      }
      return () => self;
    },
  });
  return self;
}

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: (table: string) =>
      builder(() => tables[table] ?? { data: [], error: null }),
  }),
}));
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) =>
      builder(() => (table === "projects" ? serviceProjects : profileRows)),
  }),
}));
jest.mock("@/lib/integrations/contextus", () => ({ createContextusProject: jest.fn() }));

import { GET } from "../route";

const project = {
  id: "p1",
  project_name: "Demo",
  lead_name: "Lead Name",
  lead_email: "Lead@Example.test",
  project_description: "desc",
  teammates: ["mate@example.test", "noprofile@example.test"],
  event_id: "e1",
  private: false,
  submitted: true,
  created_at: "2026-11-08T00:00:00",
  project_tracks: [],
};

// What anon can read after migration 202611080501 (no email columns).
const { lead_email: _leadEmail, teammates: _teammates, ...anonProject } = project;
void _leadEmail;
void _teammates;

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/projects?${query}`));

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  mockGetUser.mockResolvedValue({ data: { user: null } });
  tables.events = { data: { visibility: "public", event_id: "e1" }, error: null };
  tables.projects = { data: anonProject, error: null };
  serviceProjects.data = [project];
  serviceProjects.error = null;
  tables.prize_winners = { data: [], error: null };
  profileRows.data = [
    { uid: "u-lead", email: "lead@example.test", display_name: "Lead Display", avatar_url: null, affiliation: "Uni" },
    { uid: "u-mate", email: "mate@example.test", display_name: "Mate Display", avatar_url: null, affiliation: null },
  ];
});

describe("GET /api/projects?public=true", () => {
  it("never returns member emails for a single public project", async () => {
    const response = await get("public=true&projectId=p1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/example\.test/i);
    expect(body.project.lead_email).toBeUndefined();
    expect(body.project.teammates).toBeUndefined();
    expect(body.project.team_members).toEqual([
      { id: "u-lead", display_name: "Lead Display", avatar_url: null, affiliation: "Uni", role: "lead" },
      { id: "u-mate", display_name: "Mate Display", avatar_url: null, affiliation: null, role: "member" },
      { id: null, display_name: "Team member", avatar_url: null, affiliation: null, role: "member" },
    ]);
  });

  it("is not an email -> membership oracle (memberEmail is ignored)", async () => {
    const hit = await (await get("public=true&projectId=p1&memberEmail=mate%40example.test")).json();
    const miss = await (await get("public=true&projectId=p1&memberEmail=stranger%40example.test")).json();
    expect(hit).toEqual(miss);
    expect(hit.matched_member_id).toBeUndefined();
  });

  it("never returns member emails in an event listing", async () => {
    tables.projects = { data: [anonProject], error: null };
    tables.prizes = { data: [], error: null };
    const response = await get("public=true&eventId=e1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projects).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/example\.test/i);
    expect(body.projects[0].team_members.map((m: { display_name: string }) => m.display_name)).toEqual([
      "Lead Display",
      "Mate Display",
      "Team member",
    ]);
  });

  it("falls back to the project lead name when the lead has no profile", async () => {
    profileRows.data = [];
    const body = await (await get("public=true&projectId=p1")).json();
    expect(body.project.team_members[0]).toMatchObject({ id: null, display_name: "Lead Name", role: "lead" });
  });

  it("returns an empty roster (not an error or emails) when the team lookup fails", async () => {
    serviceProjects.data = null;
    serviceProjects.error = { message: "boom" };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const response = await get("public=true&projectId=p1");
    expect(response.status).toBe(200);
    expect((await response.json()).project.team_members).toEqual([]);
    spy.mockRestore();
  });

  it("serves a public project whose event was deleted (event_id NULL)", async () => {
    tables.projects = { data: { ...anonProject, event_id: null }, error: null };
    tables.events = { data: null, error: null };
    const response = await get("public=true&projectId=p1");
    expect(response.status).toBe(200);
    expect((await response.json()).project.event_id).toBeNull();
  });

  describe("JUDGE-009: non-public events", () => {
    beforeEach(() => {
      tables.events = { data: { visibility: "private", event_id: "e1" }, error: null };
      tables.projects = { data: [anonProject], error: null };
      tables.prizes = { data: [], error: null };
    });

    it("hides projects from anonymous viewers", async () => {
      expect((await get("public=true&eventId=e1")).status).toBe(404);
    });

    it("hides projects from signed-in non-members", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "outsider" } } });
      tables.user_event_roles = { data: [], error: null };
      expect((await get("public=true&eventId=e1")).status).toBe(404);
    });

    it("lists email-free projects for event members (popular voting)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "member" } } });
      tables.user_event_roles = { data: [{ role: "participant" }], error: null };
      const response = await get("public=true&eventId=e1");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.projects).toHaveLength(1);
      expect(JSON.stringify(body)).not.toMatch(/example\.test/i);
    });

    it("fails closed when the membership lookup errors", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "member" } } });
      tables.user_event_roles = { data: null, error: { message: "boom" } };
      expect((await get("public=true&eventId=e1")).status).toBe(404);
    });
  });
});

describe("GET /api/projects (authenticated)", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "viewer" } } });
    teamEmailRows = [];
    tables.projects = { data: anonProject, error: null };
  });

  it("gives a signed-in non-member the email-free payload", async () => {
    const body = await (await get("projectId=p1")).json();
    expect(JSON.stringify(body)).not.toMatch(/example\.test/i);
    expect(mockRpc).toHaveBeenCalledWith("project_team_emails", { p_project_ids: ["p1"] });
    expect(body.project.team_members.map((m: { display_name: string }) => m.display_name)).toEqual(["Lead Display", "Mate Display", "Team member"]);
  });

  it("gives team members / organizers the emails (from project_team_emails)", async () => {
    teamEmailRows = [{ project_id: "p1", lead_email: "Lead@Example.test", teammates: ["mate@example.test", "noprofile@example.test"] }];
    const body = await (await get("projectId=p1")).json();
    expect(body.project.lead_email).toBe("Lead@Example.test");
    expect(body.project.team_members[1]).toMatchObject({ id: "u-mate", email: "mate@example.test" });
  });

  it("strips emails from the event listing for non-members", async () => {
    tables.user_event_roles = { data: { role: "participant" }, error: null };
    tables.projects = { data: [anonProject], error: null };
    const body = await (await get("eventId=e1")).json();
    expect(body.projects).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/example\.test/i);
  });

  it("includes emails in the event listing only for projects the RPC allows", async () => {
    tables.user_event_roles = { data: { role: "organizer" }, error: null };
    tables.projects = { data: [anonProject, { ...anonProject, id: "p2" }], error: null };
    teamEmailRows = [{ project_id: "p1", lead_email: "lead@example.test", teammates: [] }];
    const body = await (await get("eventId=e1")).json();
    expect(body.projects.find((p: { id: string }) => p.id === "p1").lead_email).toBe("lead@example.test");
    expect(body.projects.find((p: { id: string }) => p.id === "p2").lead_email).toBeUndefined();
  });
});
