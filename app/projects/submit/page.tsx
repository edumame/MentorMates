"use client";

import { NewProjectSubmissionFormSinglePage } from "@/features/projects/components/forms/NewProjectSubmissionFormSinglePage";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { Button } from "@/components/ui/button";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";

export default function SubmitProjectPage() {
  const searchParams = useSearchParams();
  const eventSlugOrId = searchParams.get("eventId");

  const [eventId, setEventId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [contextusId, setContextusId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!eventSlugOrId);

  // Resolve event ID from slug or UUID
  useEffect(() => {
    const resolveEventId = async () => {
      if (!eventSlugOrId) {
        setIsLoading(false);
        return;
      }

      const isUUID = isValidUUID(eventSlugOrId);
      let query = supabase.from("events").select("event_id");

      if (isUUID) {
        query = query.or(`slug.eq.${eventSlugOrId},event_id.eq.${eventSlugOrId}`);
      } else {
        query = query.eq("slug", eventSlugOrId);
      }

      const { data } = await query.maybeSingle();
      if (data) setEventId(data.event_id);
      setIsLoading(false);
    };
    resolveEventId();
  }, [eventSlugOrId]);

  // Get current user info
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

  if (isLoading) {
    return (
      <PageContainer showBorder={false}>
        <div className="flex items-center justify-center flex-grow">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer showBorder={false}>
      <Toaster />
      <PageContent>
        {contextusId && (
          <div className="sticky top-0 z-10 mb-4 rounded-md border p-3 bg-blue-50 text-blue-800 flex items-center justify-between mx-auto shrink-0">
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
          eventId={eventId || undefined}
          onContextusLinked={(ctxId) => setContextusId(ctxId)}
          contextusId={contextusId}
        />
      </PageContent>
    </PageContainer>
  );
}
