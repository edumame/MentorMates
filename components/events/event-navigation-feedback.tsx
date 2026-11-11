"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Keep feedback tied to Next's navigation lifecycle, including interrupted navigation. */
export function EventNavigationFeedback() {
  const { pending } = useLinkStatus();

  return (
    <span role="status" aria-live="polite" aria-atomic="true" className="ml-auto h-4 w-4 shrink-0">
      {pending && (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          <span className="sr-only">Opening event…</span>
        </>
      )}
    </span>
  );
}
