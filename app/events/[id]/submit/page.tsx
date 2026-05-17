"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Direct submission link: /events/[id]/submit
 * Redirects to the project submission form with the event pre-filled.
 * Share this link with participants for one-click project submission.
 */
export default function EventSubmitPage() {
  const params = useParams<{ id: string }>();

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    // Use a hard browser navigation so the destination fully reloads.
    window.location.replace(`/projects/submit?eventId=${encodeURIComponent(id)}`);
  }, [params.id]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-2 text-gray-600">Loading project submission...</p>
      </div>
    </div>
  );
}
