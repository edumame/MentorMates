import { MAX_COVER_IMAGE_BYTES, validateCoverImageFile } from "./file";
import { applyScrapedData, INITIAL_WIZARD_EVENT } from "@/lib/types/wizard";

const file = (size: number, type: string) =>
  new File([new Uint8Array(size)], "f", { type });

describe("validateCoverImageFile", () => {
  it("accepts an image at exactly the size limit", () => {
    expect(validateCoverImageFile(file(MAX_COVER_IMAGE_BYTES, "image/jpeg"))).toBeNull();
  });
  it("rejects images over the limit", () => {
    expect(validateCoverImageFile(file(MAX_COVER_IMAGE_BYTES + 1, "image/jpeg"))).toMatch(/5MB/);
  });
  it("rejects non-image and untyped files", () => {
    expect(validateCoverImageFile(file(1, "application/pdf"))).toMatch(/image file/);
    expect(validateCoverImageFile(file(1, ""))).toMatch(/image file/);
  });
});

describe("applyScrapedData cover image", () => {
  const picked = file(1, "image/png");
  it("an imported cover URL replaces a picked file", () => {
    const out = applyScrapedData(
      { cover_image_url: "https://x.test/c.png" },
      { ...INITIAL_WIZARD_EVENT, cover_image_file: picked }
    );
    expect(out.cover_image_url).toBe("https://x.test/c.png");
    expect(out.cover_image_file).toBeUndefined();
  });
  it("keeps a picked file when the import has no cover image", () => {
    const out = applyScrapedData(
      { event_name: "Hack" },
      { ...INITIAL_WIZARD_EVENT, cover_image_file: picked }
    );
    expect(out.cover_image_file).toBe(picked);
  });
});
