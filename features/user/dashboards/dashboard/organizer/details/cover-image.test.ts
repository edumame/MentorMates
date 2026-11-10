import {
  sniffCoverImageType,
  buildCoverImagePath,
  uploadEventCoverImage,
  validateCoverImage,
} from "./cover-image";

describe("cover image rules (ORG-022)", () => {
  it("accepts raster images up to 5MB", () => {
    expect(validateCoverImage({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateCoverImage({ type: "image/jpeg", size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("rejects SVG, non-images and files over 5MB", () => {
    expect(validateCoverImage({ type: "image/svg+xml", size: 10 })).toMatch(/PNG, JPEG, WebP or GIF/);
    expect(validateCoverImage({ type: "text/html", size: 10 })).toMatch(/PNG/);
    expect(validateCoverImage({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5MB/);
  });

  it("stores covers under the event folder with an extension derived from the MIME type", () => {
    expect(buildCoverImagePath("event-1", "image/jpeg")).toMatch(/^event-covers\/event-1\/[^/]+\.jpg$/);
  });
});

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const GIF_BYTES = new TextEncoder().encode("GIF89a\u0001\u0000\u0001\u0000\u0000\u0000");
const WEBP_BYTES = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");

describe("sniffCoverImageType (magic bytes)", () => {
  it.each([
    [PNG_BYTES, "image/png"],
    [JPEG_BYTES, "image/jpeg"],
    [GIF_BYTES, "image/gif"],
    [WEBP_BYTES, "image/webp"],
  ])("detects %#", async (bytes, type) => {
    expect(await sniffCoverImageType(new Blob([bytes]))).toBe(type);
  });

  it("returns null for SVG/HTML content", async () => {
    expect(await sniffCoverImageType(new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"]))).toBeNull();
    expect(await sniffCoverImageType(new Blob(["<html><script>alert(1)</script>"]))).toBeNull();
  });
});

describe("uploadEventCoverImage", () => {
  function client(uploadError: { message: string } | null) {
    const upload = jest.fn().mockResolvedValue({ error: uploadError });
    const getPublicUrl = jest.fn((path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }));
    return { upload, storage: { from: jest.fn(() => ({ upload, getPublicUrl })) } };
  }

  it("uploads with the file's content type and returns the public URL", async () => {
    const c = client(null);
    const file = new File([PNG_BYTES], "evil.svg.png", { type: "image/png" });
    const url = await uploadEventCoverImage(c as never, "event-1", file);
    expect(url).toMatch(/^https:\/\/cdn\/event-covers\/event-1\/.+\.png$/);
    expect(c.upload).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), file, {
      contentType: "image/png",
      upsert: false,
    });
  });

  it("refuses invalid files without calling storage", async () => {
    const c = client(null);
    await expect(
      uploadEventCoverImage(c as never, "event-1", new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }))
    ).rejects.toThrow(/PNG/);
    expect(c.upload).not.toHaveBeenCalled();
  });

  it("refuses SVG bytes labelled image/png without calling storage", async () => {
    const c = client(null);
    const disguised = new File(["<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"], "x.png", { type: "image/png" });
    await expect(uploadEventCoverImage(c as never, "event-1", disguised)).rejects.toThrow(/contents don't match/);
    expect(c.upload).not.toHaveBeenCalled();
  });

  it("refuses JPEG bytes declared as PNG", async () => {
    const c = client(null);
    await expect(
      uploadEventCoverImage(c as never, "event-1", new File([JPEG_BYTES], "a.png", { type: "image/png" }))
    ).rejects.toThrow(/contents don't match/);
  });

  it("surfaces storage errors", async () => {
    const c = client({ message: "Bucket not found" });
    await expect(
      uploadEventCoverImage(c as never, "event-1", new File([PNG_BYTES], "a.png", { type: "image/png" }))
    ).rejects.toThrow("Bucket not found");
  });
});
