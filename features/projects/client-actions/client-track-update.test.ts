/**
 * @jest-environment node
 */

import { assignEventProjectTracks, updateProjectTracks } from "./client-track-update";
import { deleteProjectClient } from "./client-delete";

// Reads still use the browser client; writes must not.
const mockFrom = jest.fn(() => {
  throw new Error("Track writes must go through the API, not the browser Supabase client");
});
jest.mock("@/lib/supabase", () => ({ supabase: { from: () => mockFrom() } }));

const response = (status: number, body?: unknown) =>
  ({
    ok: status < 400,
    status,
    json: body === undefined ? async () => Promise.reject(new SyntaxError("no body")) : async () => body,
  }) as Response;

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("updateProjectTracks", () => {
  it("PUTs the track ids to the project's tracks endpoint", async () => {
    fetchMock.mockResolvedValue(response(200, { trackIds: ["t1", "t2"] }));

    await expect(updateProjectTracks("p1", ["t1", "t2"])).resolves.toEqual({
      success: true,
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1/tracks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackIds: ["t1", "t2"] }),
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the API's message so the UI can show why it failed", async () => {
    fetchMock.mockResolvedValue(
      response(403, { error: "The submission deadline has passed", code: "submission_deadline_passed" }),
    );

    const result = await updateProjectTracks("p1", ["t1"]);

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("The submission deadline has passed");
  });

  it("falls back to a generic message for a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(response(502));

    const result = await updateProjectTracks("p1", ["t1"]);

    expect(result.error?.message).toBe("Failed to update project tracks");
  });

  it("falls back to a generic message for an empty error message", async () => {
    fetchMock.mockResolvedValue(response(500, { error: "   " }));

    const result = await updateProjectTracks("p1", ["t1"]);

    expect(result.error?.message).toBe("Failed to update project tracks");
  });

  it("reports a network failure instead of throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await updateProjectTracks("p1", ["t1"]);

    expect(result).toEqual({ success: false, error: new TypeError("Failed to fetch") });
  });
});

describe("assignEventProjectTracks", () => {
  const assignments = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ projectId: `p${i}`, trackIds: ["t1"] }));

  it("POSTs the mode and assignments to the event endpoint", async () => {
    fetchMock.mockResolvedValue(response(200, { projectCount: 2, added: 2, removed: 0 }));

    const result = await assignEventProjectTracks("e1", "add", assignments(2));

    expect(result).toEqual({ success: true, error: null, appliedProjects: 2 });
    expect(fetchMock).toHaveBeenCalledWith("/api/events/e1/project-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "add", assignments: assignments(2) }),
    });
  });

  it("splits large lists into batches the API accepts", async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    const result = await assignEventProjectTracks("e1", "replace", assignments(2500));

    expect(result).toEqual({ success: true, error: null, appliedProjects: 2500 });
    const batchSizes = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init.body).assignments.length,
    );
    expect(batchSizes).toEqual([1000, 1000, 500]);
  });

  it("stops at the first failed batch and says how many projects were applied", async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, {}))
      .mockResolvedValueOnce(response(400, { error: "One or more tracks do not belong to this event" }));

    const result = await assignEventProjectTracks("e1", "replace", assignments(2500));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.appliedProjects).toBe(1000);
    expect(result.error?.message).toBe("One or more tracks do not belong to this event");
  });

  it("reports a network failure with the progress so far", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await assignEventProjectTracks("e1", "add", assignments(3));

    expect(result).toEqual({
      success: false,
      error: new TypeError("Failed to fetch"),
      appliedProjects: 0,
    });
  });

  it("does nothing for an empty list", async () => {
    const result = await assignEventProjectTracks("e1", "add", []);

    expect(result).toEqual({ success: true, error: null, appliedProjects: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("deleteProjectClient", () => {
  it("DELETEs through the project API", async () => {
    fetchMock.mockResolvedValue(response(200, { success: true }));

    await expect(deleteProjectClient("p1")).resolves.toEqual({ success: true, error: null });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1", { method: "DELETE" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the API's message on failure", async () => {
    fetchMock.mockResolvedValue(response(403, { error: "Unauthorized to delete this project" }));

    const result = await deleteProjectClient("p1");

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Unauthorized to delete this project");
  });

  it("falls back to a generic message for a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(response(500));

    const result = await deleteProjectClient("p1");

    expect(result.error?.message).toBe("Failed to delete project");
  });

  it("reports a network failure instead of throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(deleteProjectClient("p1")).resolves.toEqual({
      success: false,
      error: new TypeError("Failed to fetch"),
    });
  });
});
