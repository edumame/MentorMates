/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";

// PUB-020: every contributor photo must exist under public/.
it("references only contributor images that exist in public/", () => {
  const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
  const urls = [...source.matchAll(/imageUrl:\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url.startsWith("/")).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public", url))).toBe(true);
  }
});
