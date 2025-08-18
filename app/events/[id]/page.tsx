"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EventRootPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const redirect = async () => {
      const eventId = params.id as string;
      // Redirect to the overview page
      router.replace(`/events/${eventId}/overview`);
    };
    
    redirect();
  }, [params.id, router]);

  // Show a loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Redirecting to event overview...</p>
      </div>
    </div>
  );
}