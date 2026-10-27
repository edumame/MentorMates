import { readFileSync } from "fs";
import path from "path";

// The repo's LICENSE file is the one copy of the license text; the /license
// page renders it at build time.
export function readLicenseText(): string {
  return readFileSync(path.join(process.cwd(), "LICENSE"), "utf8");
}
