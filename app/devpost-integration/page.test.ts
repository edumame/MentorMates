/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";

// PUB-IMG-001: the page must not hot-link remote images that next/image
// rejects (and that we do not control).
it("does not reference remote image hosts", () => {
  const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
  expect(source).not.toMatch(/gstatic\.com/);
  expect(source).not.toMatch(/<Image[^>]*src=["']https?:/);
});
