import type { SupabaseClient } from "@supabase/supabase-js";
import { attachEventCoverImage, uploadEventCoverImage } from "./event-cover";

function mockClient({
  uploadError = null as { message: string } | null,
  updateError = null as { message: string } | null,
} = {}) {
  const upload = jest.fn().mockResolvedValue({ error: uploadError });
  const getPublicUrl = jest.fn((path: string) => ({
    data: { publicUrl: `https://cdn.test/${path}` },
  }));
  const eq = jest.fn().mockResolvedValue({ error: updateError });
  const update = jest.fn(() => ({ eq }));
  const client = {
    storage: { from: jest.fn(() => ({ upload, getPublicUrl })) },
    from: jest.fn(() => ({ update })),
  } as unknown as SupabaseClient;
  return { client, upload, update, eq };
}

const png = new File(["x"], "My Cover.png", { type: "image/png" });

describe("uploadEventCoverImage", () => {
  it("uploads under event-covers/ with the file type and returns the public URL", async () => {
    const { client, upload } = mockClient();
    const url = await uploadEventCoverImage(client, png);
    const [path, file, opts] = upload.mock.calls[0];
    expect(path).toMatch(/^event-covers\/[a-z0-9]+\.png$/);
    expect(file).toBe(png);
    expect(opts).toEqual({ contentType: "image/png" });
    expect(url).toBe(`https://cdn.test/${path}`);
  });

  it("falls back to .png when the file name has no extension", async () => {
    const { client, upload } = mockClient();
    await uploadEventCoverImage(client, new File(["x"], "cover", { type: "image/png" }));
    expect(upload.mock.calls[0][0]).toMatch(/\.png$/);
  });

  it("throws the storage error message", async () => {
    const { client } = mockClient({
      uploadError: { message: "new row violates row-level security policy" },
    });
    await expect(uploadEventCoverImage(client, png)).rejects.toThrow(
      "new row violates row-level security policy"
    );
  });
});

describe("attachEventCoverImage", () => {
  it("saves the uploaded URL on the event", async () => {
    const { client, update, eq } = mockClient();
    const url = await attachEventCoverImage(client, "evt-1", png);
    expect(update).toHaveBeenCalledWith({ cover_image_url: url });
    expect(eq).toHaveBeenCalledWith("event_id", "evt-1");
  });

  it("does not update the event when the upload fails", async () => {
    const { client, update } = mockClient({ uploadError: { message: "nope" } });
    await expect(attachEventCoverImage(client, "evt-1", png)).rejects.toThrow("nope");
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when saving the URL fails", async () => {
    const { client } = mockClient({ updateError: { message: "update denied" } });
    await expect(attachEventCoverImage(client, "evt-1", png)).rejects.toThrow("update denied");
  });
});
