/** @jest-environment node */
const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockCreate = jest.fn();
const mockCallerRpc = jest.fn();
const mockServiceRpc = jest.fn();
let roleRows: unknown[] = [];

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockCallerRpc,
    from: (table: string) =>
      table === "user_event_roles"
        ? { select: () => ({ eq: () => ({ eq: () => ({ in: () => ({ limit: async () => ({ data: roleRows, error: null }) }) }) }) }) }
        : { select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) },
  }),
}));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: () => ({ rpc: mockServiceRpc }) }));
jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }))
);

import { GET, POST } from "./route";

const projectId = "11111111-1111-4111-8111-111111111111";
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/feedback/suggest", { method: "POST", body: JSON.stringify(body) }));
const good = { "more specific": "a", "more actionable": "b", "more positive": "c" };

beforeEach(() => {
  jest.clearAllMocks();
  roleRows = [{ role: "mentor" }];
  mockCallerRpc.mockResolvedValue({ data: [], error: null });
  mockServiceRpc.mockResolvedValue({ data: true, error: null });
  process.env.OPENAI_API_KEY = "test-key";
  mockGetUser.mockResolvedValue({ data: { user: { id: "mentor" } } });
  mockMaybeSingle.mockResolvedValue({ data: { id: projectId, event_id: "e1", project_description: "private text" }, error: null });
  mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(good) } }] });
});
afterAll(() => {
  delete process.env.OPENAI_API_KEY;
});

it("reports availability from server configuration", async () => {
  expect(await (await GET()).json()).toEqual({ available: true });
  delete process.env.OPENAI_API_KEY;
  expect(await (await GET()).json()).toEqual({ available: false });
});

it("requires authentication", async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  expect((await post({ projectId, feedback: "x" })).status).toBe(401);
  expect(mockCreate).not.toHaveBeenCalled();
});

it("returns 503 without calling any provider when unconfigured", async () => {
  delete process.env.OPENAI_API_KEY;
  const response = await post({ projectId, feedback: "x" });
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ available: false });
  expect(mockCreate).not.toHaveBeenCalled();
});

it.each([[{ projectId: "nope", feedback: "x" }], [{ projectId, feedback: "   " }], [{ projectId, feedback: "x".repeat(4001) }], [null]])(
  "rejects invalid input #%#", async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  }
);

it("does not send anything for a project the caller cannot read", async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  expect((await post({ projectId, feedback: "x" })).status).toBe(404);
  expect(mockCreate).not.toHaveBeenCalled();
});

it("returns validated suggestions", async () => {
  const response = await post({ projectId, feedback: "nice work" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ suggestions: good });
  const sent = JSON.parse(mockCreate.mock.calls[0][0].messages[1].content);
  expect(sent).toEqual({ project_description: "private text", feedback: "nice work" });
});

it.each([["not json"], [JSON.stringify({ "more specific": "a" })], [JSON.stringify({ ...good, "more positive": 3 })]])(
  "rejects malformed provider output %p", async (content) => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content } }] });
    expect((await post({ projectId, feedback: "x" })).status).toBe(502);
  }
);

it("maps provider failures to 502", async () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  mockCreate.mockRejectedValue(new Error("down"));
  expect((await post({ projectId, feedback: "x" })).status).toBe(502);
  spy.mockRestore();
});

it("refuses signed-in accounts with no role on the project's event (not a free AI proxy)", async () => {
  roleRows = [];
  expect((await post({ projectId, feedback: "x" })).status).toBe(403);
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockServiceRpc).not.toHaveBeenCalled();
});

it("allows the project's own team", async () => {
  roleRows = [];
  mockCallerRpc.mockResolvedValue({ data: [projectId], error: null });
  expect((await post({ projectId, feedback: "x" })).status).toBe(200);
});

it("enforces the DB-backed hourly quota", async () => {
  mockServiceRpc.mockResolvedValue({ data: false, error: null });
  expect((await post({ projectId, feedback: "x" })).status).toBe(429);
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockServiceRpc).toHaveBeenCalledWith("consume_feedback_suggestion_quota", { p_user_id: "mentor", p_limit: 20, p_window: "1 hour" });
});

it("fails closed when the quota check errors", async () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  mockServiceRpc.mockResolvedValue({ data: null, error: { message: "x" } });
  expect((await post({ projectId, feedback: "x" })).status).toBe(500);
  expect(mockCreate).not.toHaveBeenCalled();
  spy.mockRestore();
});
