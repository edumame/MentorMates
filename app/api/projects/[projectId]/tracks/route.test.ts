/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logAgentEvent } from "@/lib/agent/logging";
import { PATCH } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/agent/logging", () => ({
  logAgentEvent: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;
const mockLogAgentEvent = logAgentEvent as jest.Mock;

const projectId = "22222222-2222-4222-8222-222222222222";
const eventId = "11111111-1111-4111-8111-111111111111";
const userId = "44444444-4444-4444-8444-444444444444";
const trackA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trackB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const oldTrack = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function buildUserClient({
  user = { id: userId },
  role = "organizer" as string | null,
  isAdmin = false,
}: {
  user?: { id: string } | null;
  role?: string | null;
  isAdmin?: boolean;
} = {}) {
  const roleQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest
      .fn()
      .mockResolvedValue({ data: role ? { role } : null, error: null }),
  };
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: jest.fn((table: string) => {
      if (table === "user_event_roles") return roleQuery;
      throw new Error(`Unexpected user-client table ${table}`);
    }),
    rpc: jest.fn().mockResolvedValue({ data: isAdmin, error: null }),
    roleQuery,
  };
}

function buildServiceClient({
  project = { id: projectId, event_id: eventId } as {
    id: string;
    event_id: string | null;
  } | null,
  validTrackIds = [trackA, trackB],
  rpcResult = {
    data: [{ previous_track_ids: [oldTrack], track_ids: [trackA, trackB] }],
    error: null,
  } as RpcResult,
}: {
  project?: { id: string; event_id: string | null } | null;
  validTrackIds?: string[];
  rpcResult?: RpcResult;
} = {}) {
  const eventTracksIn = jest.fn((_column: string, ids: string[]) =>
    Promise.resolve({
      data: ids
        .filter((id) => validTrackIds.includes(id))
        .map((track_id) => ({ track_id })),
      error: null,
    })
  );
  return {
    from: jest.fn((table: string) => {
      if (table === "projects") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: project, error: null }),
        };
      }
      if (table === "event_tracks") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: eventTracksIn,
        };
      }
      throw new Error(`Unexpected service-client table ${table}`);
    }),
    rpc: jest.fn().mockResolvedValue(rpcResult),
    eventTracksIn,
  };
}

function patch(body: unknown, id = projectId) {
  const request = new NextRequest(
    `http://localhost/api/projects/${id}/tracks`,
    {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }
  );
  return PATCH(request, { params: Promise.resolve({ projectId: id }) });
}

function setup(
  userOpts: Parameters<typeof buildUserClient>[0] = {},
  serviceOpts: Parameters<typeof buildServiceClient>[0] = {}
) {
  const userClient = buildUserClient(userOpts);
  const serviceClient = buildServiceClient(serviceOpts);
  mockCreateSupabaseClient.mockResolvedValue(userClient);
  mockCreateServiceClient.mockReturnValue(serviceClient);
  return { userClient, serviceClient };
}

describe("PATCH /api/projects/[projectId]/tracks", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 401 when unauthenticated", async () => {
    const { serviceClient } = setup({ user: null });
    const res = await patch({ track_ids: [trackA] });
    expect(res.status).toBe(401);
    expect(serviceClient.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-uuid project id", async () => {
    setup();
    const res = await patch({ track_ids: [trackA] }, "not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const { serviceClient } = setup();
    const res = await patch("{not json");
    expect(res.status).toBe(400);
    expect(serviceClient.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["missing track_ids", {}],
    ["non-array track_ids", { track_ids: trackA }],
    ["empty-string id", { track_ids: [""] }],
    ["non-uuid id", { track_ids: ["track-1"] }],
    ["null id", { track_ids: [null] }],
  ])("returns 400 for %s", async (_label, body) => {
    const { serviceClient } = setup();
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(serviceClient.rpc).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    const { serviceClient } = setup({}, { project: null });
    const res = await patch({ track_ids: [trackA] });
    expect(res.status).toBe(404);
    expect(serviceClient.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 before any role lookup when the project has no event", async () => {
    const { userClient, serviceClient } = setup(
      {},
      { project: { id: projectId, event_id: null } }
    );
    const res = await patch({ track_ids: [trackA] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not associated with an event/);
    expect(userClient.from).not.toHaveBeenCalled();
    expect(userClient.rpc).not.toHaveBeenCalled();
    expect(serviceClient.rpc).not.toHaveBeenCalled();
  });

  it.each([["participant"], ["mentor"], ["judge"], [null]])(
    "returns 403 for a caller with role %s who is not a platform admin",
    async (role) => {
      const { serviceClient } = setup({ role, isAdmin: false });
      const res = await patch({ track_ids: [trackA] });
      expect(res.status).toBe(403);
      expect(serviceClient.rpc).not.toHaveBeenCalled();
    }
  );

  it("lets a platform admin with no event role replace tracks via the service RPC", async () => {
    const { userClient, serviceClient } = setup({ role: null, isAdmin: true });
    const res = await patch({ track_ids: [trackA, trackB] });
    expect(res.status).toBe(200);
    expect(userClient.rpc).toHaveBeenCalledWith("is_admin_user", { user_id: userId });
    expect(serviceClient.rpc).toHaveBeenCalledWith("replace_project_tracks", {
      p_project_id: projectId,
      p_track_ids: [trackA, trackB],
    });
    expect(mockLogAgentEvent).toHaveBeenCalledWith(
      "project_tracks_overridden",
      expect.objectContaining({ actorRole: "platform_admin", userId }),
      undefined,
      "info"
    );
  });

  it("returns 400 when a track belongs to another event", async () => {
    const { serviceClient } = setup({}, { validTrackIds: [trackA] });
    const res = await patch({ track_ids: [trackA, trackB] });
    expect(res.status).toBe(400);
    expect(serviceClient.rpc).not.toHaveBeenCalled();
  });

  it("maps an RPC invalid-parameter error (22023) to 400", async () => {
    setup(
      {},
      {
        rpcResult: {
          data: null,
          error: { code: "22023", message: "One or more tracks do not belong" },
        },
      }
    );
    const res = await patch({ track_ids: [trackA] });
    expect(res.status).toBe(400);
    expect(mockLogAgentEvent).not.toHaveBeenCalled();
  });

  it("dedupes duplicate track ids (case-insensitively) before validating and writing", async () => {
    const { serviceClient } = setup();
    const res = await patch({
      track_ids: [trackA, trackA.toUpperCase(), trackB, trackA],
    });
    expect(res.status).toBe(200);
    expect(serviceClient.eventTracksIn).toHaveBeenCalledWith("track_id", [trackA, trackB]);
    expect(serviceClient.rpc).toHaveBeenCalledWith("replace_project_tracks", {
      p_project_id: projectId,
      p_track_ids: [trackA, trackB],
    });
  });

  it("returns 500 and does not report success when the RPC fails", async () => {
    setup(
      {},
      { rpcResult: { data: null, error: { code: "XX000", message: "boom" } } }
    );
    const res = await patch({ track_ids: [trackA] });
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.success).toBeUndefined();
    expect(json.error).toBe("Failed to update tracks");
    expect(mockLogAgentEvent).not.toHaveBeenCalled();
  });

  it("returns 500 when the RPC returns no row", async () => {
    setup({}, { rpcResult: { data: [], error: null } });
    const res = await patch({ track_ids: [trackA] });
    expect(res.status).toBe(500);
    expect((await res.json()).success).toBeUndefined();
  });

  it("returns the final track set on the happy path and records an audit log", async () => {
    const { serviceClient } = setup({ role: "organizer" });
    const res = await patch({ track_ids: [trackB, trackA] });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      project_id: projectId,
      track_ids: [trackA, trackB],
      previous_track_ids: [oldTrack],
    });
    expect(serviceClient.rpc).toHaveBeenCalledTimes(1);
    expect(mockLogAgentEvent).toHaveBeenCalledWith(
      "project_tracks_overridden",
      expect.objectContaining({
        userId,
        eventId,
        projectId,
        actorRole: "organizer",
        previousTrackIds: [oldTrack],
        trackIds: [trackA, trackB],
      }),
      undefined,
      "info"
    );
  });

  it("allows an empty array to clear all tracks without querying event_tracks", async () => {
    const { serviceClient } = setup(
      {},
      {
        rpcResult: {
          data: [{ previous_track_ids: [oldTrack], track_ids: [] }],
          error: null,
        },
      }
    );
    const res = await patch({ track_ids: [] });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.track_ids).toEqual([]);
    expect(serviceClient.eventTracksIn).not.toHaveBeenCalled();
    expect(serviceClient.rpc).toHaveBeenCalledWith("replace_project_tracks", {
      p_project_id: projectId,
      p_track_ids: [],
    });
  });

  it("allows event admins (higher than organizer)", async () => {
    setup({ role: "admin" });
    const res = await patch({ track_ids: [trackA] });
    expect(res.status).toBe(200);
  });
});
