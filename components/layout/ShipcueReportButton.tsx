"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ReportButton, type SubmitResult } from "shipcue/react";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import {
  ADMIN_TYPES,
  PUBLIC_TYPES,
  SHIPCUE_AREAS,
  SHIPCUE_BASE_PATH,
} from "@/lib/shipcue/config";
import { floatingPlacement } from "@/lib/shipcue/placement";
import { useIsAdmin } from "@/lib/shipcue/use-is-admin";
import { uploadReportVideo } from "@/lib/shipcue/upload-video";

const ACCENT = "#4B89EF";

/** App state attached to each report. shipcue adds recent page errors itself. */
function diagnostics(): Record<string, unknown> {
  return {
    route: window.location.pathname + window.location.search,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
    commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };
}

/**
 * Signed-out visitors file through `submit`, which posts to the same handler.
 * Passing `submit` without `uploadVideo` hides shipcue's video controls, since
 * only a signed-in reporter can attach a video to their report.
 */
async function submitAnonymous(form: FormData): Promise<SubmitResult> {
  const res = await fetch(`${SHIPCUE_BASE_PATH}/reports`, { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (res.ok && body.id) return { id: body.id };
  return { error: body.error ?? "Could not send the report. Please try again." };
}


/**
 * shipcue's report button (github.com/cyu60/shipcue): bug reports, feature
 * requests and, for admins, agent tasks, all into the shipcue_reports queue
 * that coding agents work over MCP. It draws no button of its own
 * (trigger={false}): the support circle (FloatingSupportButton) opens it, as
 * do the hotkeys. The panel opens just above that circle. Hotkeys:
 * ⌃B bug, ⌃F feature, ⌘J agent task on a Mac; Alt+Shift+B/F/J elsewhere.
 */
export function ShipcueReportButton() {
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const isAdmin = useIsAdmin(userId);
  const types = userId && isAdmin ? ADMIN_TYPES : PUBLIC_TYPES;

  return (
    <div data-mm-shipcue data-placement={floatingPlacement(pathname)}>
      <ReportButton
        // Remount when the tabs change so the panel never sits on a hidden tab.
        key={types.join(",")}
        areas={SHIPCUE_AREAS}
        endpoint={SHIPCUE_BASE_PATH}
        accentColor={ACCENT}
        types={types}
        diagnostics={diagnostics}
        {...(userId
          ? { uploadVideo: uploadReportVideo }
          : { submit: submitAnonymous })}
        successMessage="Thanks! The MentorMates team has it."
        trigger={false}
      />
    </div>
  );
}
