"use client";

import { DraftProjectSubmissionFormSinglePage } from "@/features/projects/components/forms/DraftProjectSubmissionFormSinglePage";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { isValidUUID } from "@/app/utils/supabase/queries";

// Project Submission Page
export default function ProjectSubmissionPage() {
  const params = useParams();
  const slug = params.id as string;
  const projectId = params.projectId as string;
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const resolveEventAndProjectId = async () => {
      const isUUID = isValidUUID(slug);

      let query = supabase.from("events").select("event_id");

      if (isUUID) {
        // If it's a UUID, check both slug and event_id
        query = query.or(`slug.eq.${slug},event_id.eq.${slug}`);
      } else {
        // If it's not a UUID, only check slug
        query = query.eq("slug", slug);
      }

      const { data } = await query.maybeSingle();
      if (data) setEventId(data.event_id);
    };
    resolveEventAndProjectId();
  }, [slug, projectId]);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("User not found");
      }
    };
    getUser();
  }, []);

  if (!eventId || !projectId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <DraftProjectSubmissionFormSinglePage
        projectId={projectId}
        eventId={eventId}
      />
    </div>
  );
}
