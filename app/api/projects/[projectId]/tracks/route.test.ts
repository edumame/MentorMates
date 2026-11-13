/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
import {
  findTracksOutsideEvent,
  setProjectTracks,
} from "@/lib/projects/project-tracks";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { PUT } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/projects/access", () => ({ getProjectEditAccess: jest.fn() }));
jest.mock("@/lib/projects/project-tracks", () => ({
  findTracksOutsideEvent: jest.fn(),
  setProjectTracks: jest.fn(),
}));

const PROJECT = "22222222-2222-4222-8222-222222222222";
const EVENT = "11111111-1111-4111-8111-111111111111";
const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";

type Lookup = { data: unknown; error: unknown };

function serviceWith({
  project = { data: { submitted: true }, error: null },
  event = { data: { submission_time_cutoff: FUTURE }, error: null },
}: { project?: Lookup; event?: Lookup } = {}) {
  const lookup = (result: Lookup) => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(result),
    };
    return chain;
  };
  const from = jest.fn((table: string) => {
    if (table === "projects") return lookup(project);
    if (table === "events") return lookup(event);
    throw new Error(`Unexpected table ${table}`);
  });
  const service = { from };
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(service);
  return service;
}

function signedIn(user: { id: string; email: string } | null = { id: "user-1", email: "lead@x.com" }) {
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "no session" },
      }),
    },
  });
}

function access(overrides: Partial<{
  eventId: string | null;
  isLead: boolean;
  isTeammate: boolean;
  isOrganizer: boolean;
  canEdit: boolean;
}> = {}) {
  const value = {
    eventId: EVENT,
    isLead: true,
    isTeammate: false,
    isOrganizer: false,
    canEdit: true,
    ...overrides,
  };
  (getProjectEditAccess as jest.Mock).mockResolvedValue({ access: value, error: null, status: 200 });
}

function put(body: unknown, projectId = PROJECT) {
  const request = new NextRequest(`http://localhost/api/projects/${projectId}/tracks`, {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ projectId }) });
}

describe("PUT /api/projects/[projectId]/tracks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signedIn();
    serviceWith();
    access();
    (findTracksOutsideEvent as jest.Mock).mockResolvedValue([]);
    (setProjectTracks as jest.Mock).mockResolvedValue({ ok: true, added: 1, removed: 0 });
  });

  it("rejects a signed-out caller", async () => {
    signedIn(null);

    const response = await put({ trackIds: [T1] });

    expect(response.status).toBe(401);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("rejects a malformed project id", async () => {
    const response = await put({ trackIds: [T1] }, "not-a-uuid");

    expect(response.status).toBe(400);
    expect(getProjectEditAccess).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-JSON body", "{nope"],
    ["a missing trackIds", {}],
    ["a non-uuid track id", { trackIds: ["track-1"] }],
    ["too many tracks", { trackIds: Array.from({ length: 51 }, () => T1) }],
  ])("rejects %s", async (_label, body) => {
    const response = await put(body);

    expect(response.status).toBe(400);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("returns the access lookup's status for an unknown project", async () => {
    (getProjectEditAccess as jest.Mock).mockResolvedValue({
      access: null,
      error: "Project not found",
      status: 404,
    });

    const response = await put({ trackIds: [T1] });

    expect(response.status).toBe(404);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user who is not on the team or an organizer", async () => {
    access({ isLead: false, canEdit: false });

    const response = await put({ trackIds: [T1] });

    expect(response.status).toBe(403);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("checks access with the verified user, not the request", async () => {
    await put({ trackIds: [T1], userId: "someone-else" });

    expect(getProjectEditAccess).toHaveBeenCalledWith(expect.anything(), {
      projectId: PROJECT,
      userId: "user-1",
      userEmail: "lead@x.com",
    });
  });

  it("replaces the tracks atomically and returns the saved set", async () => {
    const response = await put({ trackIds: [T1, T2, T1] });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ trackIds: [T1, T2] });
    expect(findTracksOutsideEvent).toHaveBeenCalledWith(expect.anything(), EVENT, [T1, T2]);
    expect(setProjectTracks).toHaveBeenCalledWith(
      expect.anything(),
      [{ projectId: PROJECT, trackIds: [T1, T2] }],
      { replace: true },
    );
  });

  it("clears the tracks for an empty list", async () => {
    const response = await put({ trackIds: [] });

    expect(response.status).toBe(200);
    expect(setProjectTracks).toHaveBeenCalledWith(
      expect.anything(),
      [{ projectId: PROJECT, trackIds: [] }],
      { replace: true },
    );
  });

  it("lets a teammate change tracks", async () => {
    access({ isLead: false, isTeammate: true, canEdit: true });

    const response = await put({ trackIds: [T1] });

    expect(response.status).toBe(200);
  });

  describe("project without an event", () => {
    beforeEach(() => access({ eventId: null }));

    it("rejects choosing tracks", async () => {
      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(400);
      expect(setProjectTracks).not.toHaveBeenCalled();
    });

    it("allows clearing them", async () => {
      const response = await put({ trackIds: [] });

      expect(response.status).toBe(200);
      expect(findTracksOutsideEvent).not.toHaveBeenCalled();
    });
  });

  describe("submission deadline", () => {
    it("locks a submitted project's tracks for its team after the cutoff", async () => {
      serviceWith({
        project: { data: { submitted: true }, error: null },
        event: { data: { submission_time_cutoff: PAST }, error: null },
      });

      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "submission_deadline_passed" });
      expect(setProjectTracks).not.toHaveBeenCalled();
    });

    it("treats a legacy project with unknown submitted state as submitted", async () => {
      serviceWith({
        project: { data: { submitted: null }, error: null },
        event: { data: { submission_time_cutoff: PAST }, error: null },
      });

      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(403);
    });

    it("keeps a draft's tracks editable after the cutoff", async () => {
      serviceWith({
        project: { data: { submitted: false }, error: null },
        event: { data: { submission_time_cutoff: PAST }, error: null },
      });

      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(200);
    });

    it("allows the team before the cutoff", async () => {
      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(200);
    });

    it("allows the team when the event has no cutoff", async () => {
      serviceWith({ event: { data: { submission_time_cutoff: null }, error: null } });

      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(200);
    });

    it("lets an organizer change a submitted project's tracks after the cutoff", async () => {
      access({ isLead: false, isOrganizer: true, canEdit: true });
      const service = serviceWith({
        event: { data: { submission_time_cutoff: PAST }, error: null },
      });

      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(200);
      expect(service.from).not.toHaveBeenCalled();
    });

    it("fails closed when the event lookup fails", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      serviceWith({ event: { data: null, error: { message: "boom" } } });

      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(503);
      expect(setProjectTracks).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("fails closed when the project lookup fails", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      serviceWith({ project: { data: null, error: { message: "boom" } } });

      const response = await put({ trackIds: [T1] });

      expect(response.status).toBe(503);
      expect(setProjectTracks).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  it("rejects tracks from another event and names them", async () => {
    (findTracksOutsideEvent as jest.Mock).mockResolvedValue([T2]);

    const response = await put({ trackIds: [T1, T2] });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "track_not_in_event",
      invalidTrackIds: [T2],
    });
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("fails closed when the track lookup fails", async () => {
    (findTracksOutsideEvent as jest.Mock).mockResolvedValue(null);

    const response = await put({ trackIds: [T1] });

    expect(response.status).toBe(503);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("reports a failed write", async () => {
    (setProjectTracks as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      error: "Failed to update project tracks",
      code: "track_write_failed",
    });

    const response = await put({ trackIds: [T1] });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to update project tracks",
      code: "track_write_failed",
    });
  });

  it("returns 500 when the service client is unavailable", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (createSupabaseServiceClient as jest.Mock).mockImplementation(() => {
      throw new Error("supabaseKey is required.");
    });

    const response = await put({ trackIds: [T1] });

    expect(response.status).toBe(500);
    errorSpy.mockRestore();
  });
});
