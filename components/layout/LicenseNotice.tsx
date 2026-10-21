import Link from "next/link";
import { OPEN_SOURCE } from "@/lib/config/open-source";

export function LicenseNotice() {
  return (
    <>
      &copy; {new Date().getFullYear()} {OPEN_SOURCE.COPYRIGHT_HOLDER}. Open source under the{" "}
      <Link href={OPEN_SOURCE.LICENSE_PATH} className="underline">
        {OPEN_SOURCE.LICENSE_NAME}
      </Link>
      .{" "}
      <a href={OPEN_SOURCE.REPO_URL} target="_blank" rel="noopener noreferrer" className="underline">
        {OPEN_SOURCE.VIEW_SOURCE_LABEL}
      </a>
    </>
  );
}
