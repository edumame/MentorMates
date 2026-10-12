import Link from "next/link";
import { OPEN_SOURCE } from "@/lib/config/open-source";

export function LicenseNotice() {
  return (
    <>
      &copy; {new Date().getFullYear()} {OPEN_SOURCE.COPYRIGHT_HOLDER}. Open source under the{" "}
      <Link href={OPEN_SOURCE.LICENSE_PATH} className="underline">
        {OPEN_SOURCE.LICENSE_NAME}
      </Link>
      .
    </>
  );
}
