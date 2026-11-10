"use client";

import { NewProjectSubmissionFormSinglePage } from "@/features/projects/components/forms/NewProjectSubmissionFormSinglePage";
import { getUserProjectIds } from "@/lib/projects/membership";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { useRedirect } from "@/features/user/authentication/redirect/RedirectProvider";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { Button } from "@/components/ui/button";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";

import { resolveEventRouteId } from "@/lib/events/resolve-event-route";
export default function SubmitProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setReturnUrlFromCurrentLocation } = useRedirect();
  const [session, setSession] = useState<Session | null>(null);
  const [editorSession, setEditorSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const eventSlugOrId = searchParams.get("eventId");
  // Capture only the entry URL. Adding a draft ID after saving must not replace
  // the live editor (and discard changes typed while its request was pending).
  const [resumeDraftId] = useState(() => {
    const id = searchParams.get("draftId");
    return id && isValidUUID(id) ? id : null;
  });

  useEffect(() => {
    if (session && resumeDraftId) router.replace(`/projects/${resumeDraftId}/edit`);
  }, [session, resumeDraftId, router]);

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

      // ORG-014: same id-before-slug rule as the event pages.
      const resolvedEventId = await resolveEventRouteId(supabase, eventSlugOrId);
      if (resolvedEventId) setEventId(resolvedEventId);
      setIsLoading(false);
    };
    resolveEventId();
  }, [eventSlugOrId]);

  // Subscribe before loading the session so sign-out/expiry cannot leave an editable form.
  useEffect(() => {
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authChanged = true;
      if (active) {
        setSession(nextSession);
        setIsAuthLoading(false);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && !authChanged) {
        setSession(data.session);
        setIsAuthLoading(false);
      }
    }).catch(() => {
      if (active && !authChanged) setIsAuthLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (session) setEditorSession(session);
    setUserEmail(session?.user.email || null);
    setUserName(session?.user.user_metadata?.full_name || session?.user.user_metadata?.name || null);
    if (session?.user.id) {
      void supabase.from("user_profiles").select("display_name")
        .eq("uid", session.user.id).single().then(({ data: profile }) => {
          if (active && profile?.display_name) setUserName(profile.display_name);
        });
    }
    return () => { active = false; };
  }, [session]);

  // Fetch the user's latest draft for this event and show Contextus ID
  useEffect(() => {
    const fetchDraft = async () => {
      if (!eventId || !userEmail) return;
      // Team email columns are not client-readable; membership comes from
      // my_project_ids (the caller's own projects in this event).
      const { ids } = await getUserProjectIds(supabase, eventId);
      if (!ids || ids.length === 0) return;
      const { data } = await supabase
        .from("projects")
        .select("id, contextus_project_id, submitted, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.contextus_project_id) setContextusId(data.contextus_project_id);
    };
    fetchDraft();
  }, [eventId, userEmail]);

  if (isAuthLoading || (session && (isLoading || resumeDraftId))) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </PageContainer>
    );
  }

  if (!session && !editorSession) {
    return (
      <PageContainer>
        <PageContent className="flex min-h-[320px] flex-col items-start gap-4 px-6 pb-12 pt-28 sm:px-8">
          <h1 className="text-2xl font-semibold">Sign in to create your project</h1>
          <p>Sign in before editing so your project can be saved to your account.</p>
          <Button onClick={() => {
            const returnUrl = setReturnUrlFromCurrentLocation();
            router.push(`/login${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`);
          }}>Sign in to continue</Button>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Toaster />
      <PageContent className="flex flex-col">
        {!session && (
          <div role="alert" className="mb-4 rounded-md border border-amber-400 bg-amber-50 p-4">
            <p>Your session ended. Your edits are still in this tab, but changes are not being saved.</p>
            <a className="underline" href={`/login?returnUrl=${encodeURIComponent(`/projects/submit${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)}`} target="_blank" rel="noopener noreferrer">Sign in again in a new tab, then return here to save.</a>
          </div>
        )}
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
        <fieldset disabled={!session}>
        <NewProjectSubmissionFormSinglePage
          key={session?.user.id || editorSession?.user.id}
          isSessionActive={Boolean(session)}
          userEmail={session?.user.email || editorSession?.user.email || ""}
          leadName={(userEmail === session?.user.email ? userName : session?.user.user_metadata?.full_name) || ""}
          eventId={eventId || undefined}
          onContextusLinked={(ctxId) => setContextusId(ctxId)}
          contextusId={contextusId}
          onDraftSaved={(id) => {
            if (window.location.pathname !== "/projects/submit") return;
            const url = new URL(window.location.href);
            if (url.searchParams.get("draftId") === id) return;
            url.searchParams.set("draftId", id);
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          }}
        />
        </fieldset>
      </PageContent>
    </PageContainer>
  );
}
