/** @jest-environment node */
import { memoryStore } from "shipcue/server";

const store = memoryStore();
const getUser = jest.fn();
const shipcueDeps = jest.fn(() => ({
  store,
  getUser,
  isAdmin: jest.fn().mockResolvedValue(false),
  agentToken: "route-token",
}));

jest.mock("@/lib/shipcue/server", () => ({ shipcueDeps: () => shipcueDeps() }));

import { GET, POST } from "./route";

const URL_BASE = "http://localhost/api/shipcue";

describe("app/api/shipcue/[...path]", () => {
  beforeEach(() => getUser.mockResolvedValue({ id: "u1", email: "pat@example.com" }));

  it("files a report from the button with the signed-in user's email", async () => {
    const form = new FormData();
    form.set("type", "feature");
    form.set("area", "judging");
    form.set("description", "Let judges leave a voice note with their score.");
    const res = await POST(new Request(`${URL_BASE}/reports`, { method: "POST", body: form }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(await store.get(id)).toMatchObject({ reporter: "pat@example.com", area: "judging" });
  });

  it("serves the agent API on GET with the SHIPCUE_TOKEN bearer token", async () => {
    const res = await GET(
      new Request(`${URL_BASE}/reports?status=open`, {
        headers: { authorization: "Bearer route-token" },
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).reports.length).toBeGreaterThan(0);
    expect((await GET(new Request(`${URL_BASE}/reports`))).status).toBe(401);
  });

  it("builds the handler once and reuses it", async () => {
    await GET(new Request(`${URL_BASE}/reports`));
    await GET(new Request(`${URL_BASE}/reports`));
    expect(shipcueDeps).toHaveBeenCalledTimes(1);
  });

  it("answers 404 outside /reports", async () => {
    expect((await GET(new Request(`${URL_BASE}/nothing-here`))).status).toBe(404);
  });
});
