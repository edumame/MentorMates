/** @jest-environment node */
import { memoryStore, type ReportStore } from "shipcue/server";
import { finishVideoUpload, startVideoUpload, videoPath, type VideoDeps } from "@/lib/shipcue/video";
import type { ShipcueUser } from "@/lib/shipcue/handler";

const PAT: ShipcueUser = { id: "u-pat", email: "pat@example.com" };

async function fileReport(store: ReportStore, reporter: string | null) {
  return store.create({
    type: "bug",
    priority: "medium",
    area: "events",
    description: "The map does not load.",
    pageUrl: "",
    userAgent: "",
    diagnostics: {},
    screenshots: [],
    reporter,
  });
}

function setup(user: ShipcueUser | null, size: number | null = 1000) {
  const store = memoryStore();
  const deps: VideoDeps = {
    store,
    getUser: async () => user,
    createUpload: jest.fn(async () => ({ token: "tok" })),
    objectSize: jest.fn(async () => size),
    publicUrl: (path) => `https://cdn.example/${path}`,
  };
  const call = (fn: typeof startVideoUpload, method: string, body: unknown) =>
    fn(new Request("http://localhost/api/shipcue/video", { method, body: JSON.stringify(body) }), deps);
  return { store, deps, call };
}

describe("direct video uploads for shipcue reports", () => {
  it("gives the reporter a signed upload and links the video once it lands", async () => {
    const { store, deps, call } = setup(PAT);
    const report = await fileReport(store, PAT.email);

    const start = await call(startVideoUpload, "POST", { reportId: report.id, type: "video/webm", size: 1000 });
    expect(start.status).toBe(200);
    const { path, token } = await start.json();
    expect(path).toBe(videoPath(report.id, "webm"));
    expect(path).toBe(`shipcue/${report.id}/video.webm`);
    expect(token).toBe("tok");
    expect(deps.createUpload).toHaveBeenCalledWith(path);

    const done = await call(finishVideoUpload, "PUT", { reportId: report.id, path });
    expect(done.status).toBe(200);
    expect((await store.get(report.id))?.video).toBe(`https://cdn.example/${path}`);

    const twice = await call(startVideoUpload, "POST", { reportId: report.id, type: "video/webm", size: 1000 });
    expect(twice.status).toBe(409);
  });

  it("needs a signed-in user", async () => {
    const { store, call } = setup(null);
    const report = await fileReport(store, null);
    const res = await call(startVideoUpload, "POST", { reportId: report.id, type: "video/webm", size: 10 });
    expect(res.status).toBe(401);
  });

  it("refuses someone else's report and anonymous reports", async () => {
    const { store, call } = setup(PAT);
    const theirs = await fileReport(store, "someone@example.com");
    const anon = await fileReport(store, null);
    for (const r of [theirs, anon]) {
      const res = await call(startVideoUpload, "POST", { reportId: r.id, type: "video/mp4", size: 10 });
      expect(res.status).toBe(403);
    }
  });

  it("refuses types and sizes shipcue does not allow", async () => {
    const { store, call } = setup(PAT);
    const report = await fileReport(store, PAT.email);
    expect((await call(startVideoUpload, "POST", { reportId: report.id, type: "image/gif", size: 10 })).status).toBe(400);
    expect((await call(startVideoUpload, "POST", { reportId: report.id, type: "video/webm", size: 0 })).status).toBe(400);
    expect(
      (await call(startVideoUpload, "POST", { reportId: report.id, type: "video/webm", size: 500 * 1024 * 1024 })).status
    ).toBe(400);
  });

  it("refuses a path outside the report's folder", async () => {
    const { store, call } = setup(PAT);
    const report = await fileReport(store, PAT.email);
    const res = await call(finishVideoUpload, "PUT", { reportId: report.id, path: "shipcue/other/video.webm" });
    expect(res.status).toBe(400);
    expect((await store.get(report.id))?.video).toBeNull();
  });

  it("does not link a video that never reached storage", async () => {
    const { store, call } = setup(PAT, null);
    const report = await fileReport(store, PAT.email);
    const res = await call(finishVideoUpload, "PUT", { reportId: report.id, path: videoPath(report.id, "mp4") });
    expect(res.status).toBe(409);
    expect((await store.get(report.id))?.video).toBeNull();
  });

  it("closes the window 30 minutes after the report was filed", async () => {
    const { store, call } = setup(PAT);
    const report = await fileReport(store, PAT.email);
    const now = jest.spyOn(Date, "now").mockReturnValue(Date.parse(report.createdAt) + 31 * 60 * 1000);
    try {
      const res = await call(startVideoUpload, "POST", { reportId: report.id, type: "video/webm", size: 10 });
      expect(res.status).toBe(403);
    } finally {
      now.mockRestore();
    }
  });
});
