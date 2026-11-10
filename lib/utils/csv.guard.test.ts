/** @jest-environment node */
import fs from "fs";
import path from "path";

// ORG-001: every CSV download must go through toSpreadsheetSafeCsv
// (lib/utils/csv.ts), which neutralises spreadsheet formulas.
const ROOT = path.resolve(__dirname, "../..");
const DIRS = ["app", "components", "features", "lib", "modules"];
const ALLOWED = new Set([path.join("lib", "utils", "csv.ts")]);

function walk(dir: string, out: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
}

it("no source file calls Papa.unparse directly", () => {
  const files: string[] = [];
  DIRS.forEach((dir) => walk(path.join(ROOT, dir), files));
  const offenders = files
    .filter((file) => !ALLOWED.has(path.relative(ROOT, file)))
    .filter((file) => /\bunparse\s*\(/.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(ROOT, file));
  expect(offenders).toEqual([]);
});
