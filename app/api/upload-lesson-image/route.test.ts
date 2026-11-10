/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

function setup({ user = { id: "u1" } as { id: string } | null, role = null as string | null } = {}) {
  const upload = jest.fn(async () => ({ data: { path: "p" }, error: null }));
  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: role ? { role } : null, error: null }) };
      return q;
    },
    storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: "https://cdn.test/p" } }) }) },
  } as never);
  return { upload };
}

function multipart(fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v as never);
  return new NextRequest("http://localhost/api/upload-lesson-image", { method: "POST", body: form });
}

describe("POST /api/upload-lesson-image (PUB-015)", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));

  it("returns 401 for signed-out callers", async () => {
    setup({ user: null });
    expect((await POST(multipart({}))).status).toBe(401);
  });

  it("returns 400 (not 500) for a non-multipart body", async () => {
    setup();
    const req = new NextRequest("http://localhost/api/upload-lesson-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 when the file field is a plain string or eventId is not a UUID", async () => {
    setup();
    expect((await POST(multipart({ file: "not-a-file", eventId: EVENT_ID }))).status).toBe(400);
    const file = new File([PNG], "a.png", { type: "image/png" });
    expect((await POST(multipart({ file, eventId: "nope" }))).status).toBe(400);
  });

  it("returns 403 (not 500) when the caller has no role in the event", async () => {
    setup({ role: null });
    const file = new File([PNG], "a.png", { type: "image/png" });
    expect((await POST(multipart({ file, eventId: EVENT_ID }))).status).toBe(403);
  });

  it("uploads for an organizer", async () => {
    const { upload } = setup({ role: "organizer" });
    const file = new File([PNG], "a.png", { type: "image/png" });
    const res = await POST(multipart({ file, eventId: EVENT_ID }));
    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalled();
  });
});
