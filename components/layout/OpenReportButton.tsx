"use client";

import * as React from "react";
import { openReport } from "shipcue/react";
import type { ReportType } from "shipcue";

/** Opens the shipcue report panel (ShipcueReportButton) on a tab. For server-rendered pages. */
export function OpenReportButton({
  type,
  className,
  children,
}: {
  type: Extract<ReportType, "bug" | "feature">;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openReport(type)} className={className}>
      {children}
    </button>
  );
}
