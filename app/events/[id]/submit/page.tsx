"use client";

import { NewProjectSubmissionFormSinglePage } from "@/features/projects/components/forms/NewProjectSubmissionFormSinglePage";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { Button } from "@/components/ui/button";

// Project Submission Page
export default function ProjectSubmissionPage() {
  const params = useParams();
  const slug = params.id as string;
  const [eventId, setEventId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [contextusId, setContextusId] = useState<string | null>(null);

  useEffect(() => {
    const resolveEventId = async () => {
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
    resolveEventId();
  }, [slug]);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || null);
        setUserName(
          session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            null
        );

        // Get user profile data
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("uid", session.user.id)
          .single();

        if (profile) {
          setUserName(
            profile.display_name ||
              session.user.user_metadata?.full_name ||
              null
          );
        }
      }
    };
    getUser();
  }, []);

  // Fetch the user's latest draft for this event and show Contextus ID
  useEffect(() => {
    const fetchDraft = async () => {
      if (!eventId || !userEmail) return;
      const { data } = await supabase
        .from("projects")
        .select("id, contextus_project_id, lead_email, submitted, created_at")
        .eq("event_id", eventId)
        .eq("lead_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.contextus_project_id) setContextusId(data.contextus_project_id);
    };
    fetchDraft();
  }, [eventId, userEmail]);

  if (!eventId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {contextusId && (
        <div className="mb-4 rounded-md border p-3 bg-blue-50 text-blue-800 flex items-center justify-between">
          <div>
            <span className="font-semibold">Contextus ID:</span> {contextusId}
          </div>
          <Button
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(contextusId)}
          >
            Copy
          </Button>
        </div>
      )}
      <NewProjectSubmissionFormSinglePage
        userEmail={userEmail || ""}
        leadName={userName || ""}
        eventId={eventId}
        onContextusLinked={(ctxId) => setContextusId(ctxId)}
        contextusId={contextusId}
      />
    </div>
  );
}
