/**
 * @jest-environment node
 */

import { findTracksOutsideEvent, setProjectTracks } from "./project-tracks";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVENT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function rpcClient(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  return { client: { rpc } as never, rpc };
}

describe("setProjectTracks", () => {
  it("sends one atomic call with de-duplicated track ids", async () => {
    const { client, rpc } = rpcClient({ data: [{ added: 2, removed: 1 }], error: null });

    const result = await setProjectTracks(
      client,
      [
        { projectId: P1, trackIds: [T1, T2, T1] },
        { projectId: P2, trackIds: [] },
      ],
      { replace: true },
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("set_project_tracks", {
      p_assignments: [
        { project_id: P1, track_ids: [T1, T2] },
        { project_id: P2, track_ids: [] },
      ],
      p_replace: true,
    });
    expect(result).toEqual({ ok: true, added: 2, removed: 1 });
  });

  it("passes add mode through as p_replace = false", async () => {
    const { client, rpc } = rpcClient({ data: [{ added: 1, removed: 0 }], error: null });

    await setProjectTracks(client, [{ projectId: P1, trackIds: [T1] }], { replace: false });

    expect(rpc.mock.calls[0][1]).toMatchObject({ p_replace: false });
  });

  it("does not call the database for an empty batch", async () => {
    const { client, rpc } = rpcClient({ data: null, error: null });

    await expect(setProjectTracks(client, [], { replace: true })).resolves.toEqual({
      ok: true,
      added: 0,
      removed: 0,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a single-row (non-array) result", async () => {
    const { client } = rpcClient({ data: { added: 3, removed: 0 }, error: null });

    await expect(
      setProjectTracks(client, [{ projectId: P1, trackIds: [T1] }], { replace: true }),
    ).resolves.toEqual({ ok: true, added: 3, removed: 0 });
  });

  it("treats a missing count as zero", async () => {
    const { client } = rpcClient({ data: [], error: null });

    await expect(
      setProjectTracks(client, [{ projectId: P1, trackIds: [T1] }], { replace: true }),
    ).resolves.toEqual({ ok: true, added: 0, removed: 0 });
  });

  it("maps the same-event trigger (23514) to a 400", async () => {
    const { client } = rpcClient({ data: null, error: { code: "23514", message: "Track does not belong" } });

    await expect(
      setProjectTracks(client, [{ projectId: P1, trackIds: [T1] }], { replace: true }),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      error: "One or more tracks do not belong to this project's event",
      code: "track_not_in_event",
    });
  });

  it("maps any other database error to a 500 without leaking its message", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { client } = rpcClient({ data: null, error: { code: "42501", message: "permission denied" } });

    const result = await setProjectTracks(client, [{ projectId: P1, trackIds: [T1] }], {
      replace: true,
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "Failed to update project tracks",
      code: "track_write_failed",
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("findTracksOutsideEvent", () => {
  function tracksClient(result: { data: unknown; error: unknown }) {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue(result),
    };
    return { client: { from: jest.fn(() => chain) } as never, chain };
  }

  it("returns the requested tracks that are not in the event", async () => {
    const { client, chain } = tracksClient({ data: [{ track_id: T1 }], error: null });

    await expect(findTracksOutsideEvent(client, EVENT, [T1, T2, T2])).resolves.toEqual([T2]);
    expect(chain.eq).toHaveBeenCalledWith("event_id", EVENT);
    expect(chain.in).toHaveBeenCalledWith("track_id", [T1, T2]);
  });

  it("returns an empty list when every track is in the event", async () => {
    const { client } = tracksClient({ data: [{ track_id: T1 }, { track_id: T2 }], error: null });

    await expect(findTracksOutsideEvent(client, EVENT, [T1, T2])).resolves.toEqual([]);
  });

  it("skips the lookup for no tracks", async () => {
    const { client, chain } = tracksClient({ data: [], error: null });

    await expect(findTracksOutsideEvent(client, EVENT, [])).resolves.toEqual([]);
    expect(chain.in).not.toHaveBeenCalled();
  });

  it("returns null when the lookup fails, so callers fail closed", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { client } = tracksClient({ data: null, error: { message: "boom" } });

    await expect(findTracksOutsideEvent(client, EVENT, [T1])).resolves.toBeNull();
    errorSpy.mockRestore();
  });
});
