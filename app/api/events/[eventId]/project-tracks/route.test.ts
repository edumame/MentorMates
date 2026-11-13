/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canManageEvent } from "@/lib/events/manage-access";
import {
  findTracksOutsideEvent,
  setProjectTracks,
} from "@/lib/projects/project-tracks";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/events/manage-access", () => ({ canManageEvent: jest.fn() }));
jest.mock("@/lib/projects/project-tracks", () => ({
  findTracksOutsideEvent: jest.fn(),
  setProjectTracks: jest.fn(),
}));

const EVENT = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";
const P2 = "33333333-3333-4333-8333-333333333333";
const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

/** Service client whose projects lookup returns the given ids as "in the event". */
function serviceWithProjects(inEvent: string[] | { error: unknown }) {
  const inCalls: string[][] = [];
  const from = jest.fn((table: string) => {
    if (table !== "projects") throw new Error(`Unexpected table ${table}`);
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn(async (_column: string, ids: string[]) => {
        inCalls.push(ids);
        if (!Array.isArray(inEvent)) return { data: null, error: inEvent.error };
        return { data: ids.filter((id) => inEvent.includes(id)).map((id) => ({ id })), error: null };
      }),
    };
    return chain;
  });
  const service = { from };
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(service);
  return { service, inCalls };
}

function signedIn(user: { id: string } | null = { id: "organizer-1" }) {
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "no session" },
      }),
    },
  });
}

function post(body: unknown, eventId = EVENT) {
  const request = new NextRequest(`http://localhost/api/events/${eventId}/project-tracks`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ eventId }) });
}

describe("POST /api/events/[eventId]/project-tracks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signedIn();
    serviceWithProjects([P1, P2]);
    (canManageEvent as jest.Mock).mockResolvedValue(true);
    (findTracksOutsideEvent as jest.Mock).mockResolvedValue([]);
    (setProjectTracks as jest.Mock).mockResolvedValue({ ok: true, added: 2, removed: 1 });
  });

  it("rejects a signed-out caller", async () => {
    signedIn(null);

    const response = await post({ mode: "add", assignments: [{ projectId: P1, trackIds: [T1] }] });

    expect(response.status).toBe(401);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("rejects a malformed event id", async () => {
    const response = await post(
      { mode: "add", assignments: [{ projectId: P1, trackIds: [T1] }] },
      "nope",
    );

    expect(response.status).toBe(400);
  });

  it.each([
    ["a non-JSON body", "{nope"],
    ["an unknown mode", { mode: "merge", assignments: [{ projectId: P1, trackIds: [T1] }] }],
    ["no assignments", { mode: "add", assignments: [] }],
    ["a non-uuid project", { mode: "add", assignments: [{ projectId: "p1", trackIds: [T1] }] }],
    ["a non-uuid track", { mode: "add", assignments: [{ projectId: P1, trackIds: ["t1"] }] }],
    [
      "more than 1000 assignments",
      {
        mode: "add",
        assignments: Array.from({ length: 1001 }, (_, i) => ({ projectId: uuid(i), trackIds: [T1] })),
      },
    ],
  ])("rejects %s", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("rejects a caller who cannot manage the event", async () => {
    (canManageEvent as jest.Mock).mockResolvedValue(false);

    const response = await post({ mode: "add", assignments: [{ projectId: P1, trackIds: [T1] }] });

    expect(response.status).toBe(403);
    expect(canManageEvent).toHaveBeenCalledWith(expect.anything(), EVENT, "organizer-1");
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("adds tracks without removing existing ones in add mode", async () => {
    const response = await post({
      mode: "add",
      assignments: [
        { projectId: P1, trackIds: [T1] },
        { projectId: P2, trackIds: [T1] },
      ],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ projectCount: 2, added: 2, removed: 1 });
    expect(setProjectTracks).toHaveBeenCalledWith(
      expect.anything(),
      [
        { projectId: P1, trackIds: [T1] },
        { projectId: P2, trackIds: [T1] },
      ],
      { replace: false },
    );
  });

  it("replaces tracks in replace mode", async () => {
    await post({ mode: "replace", assignments: [{ projectId: P1, trackIds: [T2] }] });

    expect(setProjectTracks).toHaveBeenCalledWith(
      expect.anything(),
      [{ projectId: P1, trackIds: [T2] }],
      { replace: true },
    );
  });

  it("merges a project listed twice into one assignment", async () => {
    await post({
      mode: "replace",
      assignments: [
        { projectId: P1, trackIds: [T1] },
        { projectId: P1, trackIds: [T2, T1] },
      ],
    });

    expect(setProjectTracks).toHaveBeenCalledWith(
      expect.anything(),
      [{ projectId: P1, trackIds: [T1, T2] }],
      { replace: true },
    );
  });

  it("rejects the whole batch when any project is from another event", async () => {
    serviceWithProjects([P1]);

    const response = await post({
      mode: "add",
      assignments: [
        { projectId: P1, trackIds: [T1] },
        { projectId: P2, trackIds: [T1] },
      ],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "project_not_in_event",
      invalidProjectIds: [P2],
    });
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("looks projects up in chunks so the request URL stays short", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => uuid(i));
    const { inCalls } = serviceWithProjects(ids);

    const response = await post({
      mode: "add",
      assignments: ids.map((projectId) => ({ projectId, trackIds: [T1] })),
    });

    expect(response.status).toBe(200);
    expect(inCalls.map((chunk) => chunk.length)).toEqual([200, 200, 50]);
  });

  it("fails closed when the project lookup fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    serviceWithProjects({ error: { message: "boom" } });

    const response = await post({ mode: "add", assignments: [{ projectId: P1, trackIds: [T1] }] });

    expect(response.status).toBe(503);
    expect(setProjectTracks).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("checks every requested track against the event", async () => {
    await post({
      mode: "replace",
      assignments: [
        { projectId: P1, trackIds: [T1] },
        { projectId: P2, trackIds: [T2] },
      ],
    });

    expect(findTracksOutsideEvent).toHaveBeenCalledWith(expect.anything(), EVENT, [T1, T2]);
  });

  it("rejects tracks from another event and names them", async () => {
    (findTracksOutsideEvent as jest.Mock).mockResolvedValue([T2]);

    const response = await post({ mode: "add", assignments: [{ projectId: P1, trackIds: [T2] }] });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "track_not_in_event",
      invalidTrackIds: [T2],
    });
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("fails closed when the track lookup fails", async () => {
    (findTracksOutsideEvent as jest.Mock).mockResolvedValue(null);

    const response = await post({ mode: "add", assignments: [{ projectId: P1, trackIds: [T1] }] });

    expect(response.status).toBe(503);
    expect(setProjectTracks).not.toHaveBeenCalled();
  });

  it("reports a failed write", async () => {
    (setProjectTracks as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      error: "One or more tracks do not belong to this project's event",
      code: "track_not_in_event",
    });

    const response = await post({ mode: "add", assignments: [{ projectId: P1, trackIds: [T1] }] });

    expect(response.status).toBe(400);
  });
});
