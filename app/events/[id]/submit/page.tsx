"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect to unified project creation page
export default function EventSubmitRedirect() {
  const params = useParams();
  const router = useRouter();
  const eventSlug = params.id as string;

  useEffect(() => {
    // Redirect to the unified project submit page with event ID as query param
    router.replace(`/projects/submit?eventId=${eventSlug}`);
  }, [eventSlug, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting...</p>
    </div>
  );
}
