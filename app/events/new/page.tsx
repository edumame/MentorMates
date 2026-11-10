"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EventVisibility } from "@/lib/types";
import { useToast } from "@/lib/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type WizardEventData,
  INITIAL_WIZARD_EVENT,
  buildApiPayload,
  applyScrapedData,
  EVENT_NAME_MAX_LENGTH,
  slugify,
  validateSubmissionWindow,
} from "@/lib/types/wizard";
import { getEventSlugError } from "@/lib/events/event-slug";
import {
  uploadEventCoverImage,
  validateCoverImage,
} from "@/features/user/dashboards/dashboard/organizer/details/cover-image";
import { fieldsToApiPayload } from "@/components/events/submission";
import { WizardShell } from "./components/WizardShell";
import { DetailsStep } from "./components/DetailsStep";
import { WizardSubmissionStep } from "./components/WizardSubmissionStep";
import { WizardJudgingStep } from "./components/WizardJudgingStep";
import { WizardInviteStep } from "./components/WizardInviteStep";

function getInviteFailureCount(inviteSummary: unknown): number {
  const summary = inviteSummary as
    | {
        failed?: { participant?: string[]; judge?: string[] };
      }
    | undefined;

  return (
    (summary?.failed?.participant?.length || 0) +
    (summary?.failed?.judge?.length || 0)
  );
}

function getOrganizerInviteFailureCount(summary: unknown): number {
  const organizerSummary = summary as { failed?: string[] } | undefined;
  return organizerSummary?.failed?.length || 0;
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEventPageInner />
    </Suspense>
  );
}

function NewEventPageInner() {
  const router = useRouter();
  const { toast } = useToast();

  // Auth
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Wizard state — single source of truth
  const [event, setEvent] = useState<WizardEventData>(INITIAL_WIZARD_EVENT);

  // Submit state
  const [creating, setCreating] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [createdEventSlug, setCreatedEventSlug] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // ── Set bg-gray-50 on the scrollable parent (SidebarLayout's <main>) ──
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Walk up to the nearest scrollable ancestor (the <main> from SidebarLayout)
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const style = getComputedStyle(parent);
      if (style.overflow === "auto" || style.overflowY === "auto") {
        parent.style.backgroundColor = "#f9fafb"; // gray-50
        const target = parent;
        return () => { target.style.backgroundColor = ""; };
      }
      parent = parent.parentElement;
    }
  }, []);

  // ── Auth check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.push("/login");
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: adminData } = await supabase.rpc("is_admin_user", {
        user_id: userId,
      });
      setIsAdmin(adminData || false);
      setLoading(false);
    };
    checkAccess();
  }, [router]);

  // ── Load prefill from localStorage ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("mentorMates-event-prefill");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;

      setEvent((prev) => applyScrapedData(parsed, prev));

      toast({
        title: "Imported event details",
        description: "Review and customize before publishing.",
      });
    } catch (error) {
      console.error("Failed to load event prefill", error);
    } finally {
      window.localStorage.removeItem("mentorMates-event-prefill");
    }
  }, [toast]);

  // ── Cover image upload ──────────────────────────────────────────────────
  // Cover uploads reuse the Edit Event rules (ORG-022): raster only, 5MB, and
  // stored under event-covers/<event_id>/ so the per-event bucket policy
  // applies. The file is validated before creating the event and uploaded
  // once the event (and the creator's organizer role) exists.
  const uploadCoverImageForEvent = async (eventId: string): Promise<boolean> => {
    if (!event.cover_image_file) return true;
    try {
      const url = await uploadEventCoverImage(supabase, eventId, event.cover_image_file);
      const { error } = await supabase
        .from("events")
        .update({ cover_image_url: url })
        .eq("event_id", eventId);
      if (error) throw new Error("Could not save the cover image");
      return true;
    } catch (err) {
      toast({
        title: "Cover image not saved",
        description:
          err instanceof Error ? err.message : "You can add it later from Edit Event.",
        variant: "destructive",
      });
      return false;
    }
  };

  // ── Get organizer emails (include current user) ─────────────────────────
  const getOrganizerEmails = async (): Promise<string[]> => {
    const { data } = await supabase.auth.getSession();
    const currentEmail = data?.session?.user?.email?.trim().toLowerCase();

    const emails = (event.organizer_emails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (currentEmail && !emails.includes(currentEmail)) {
      emails.unshift(currentEmail);
    }
    return emails;
  };

  // ── Save submission fields after event creation ─────────────────────────
  const saveSubmissionFields = async (eventId: string) => {
    if (event.submission_fields.length === 0) return;
    try {
      await fetch(`/api/events/${eventId}/submission-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: fieldsToApiPayload(event.submission_fields as never) }),
      });
    } catch {
      // Non-critical
    }
  };

  // ── Create event (shared logic) ─────────────────────────────────────────
  // Moderation (approval/featured) is decided server-side, never sent from here.
  const createEvent = async (visibility: EventVisibility) => {
    if (!event.event_name.trim() || !event.event_date || !event.location) {
      toast({
        title: "Missing fields",
        description: "Name, date, and location are required.",
        variant: "destructive",
      });
      return null;
    }

    if (event.event_name.trim().length > EVENT_NAME_MAX_LENGTH) {
      toast({
        title: "Event name too long",
        description: `Event names can be at most ${EVENT_NAME_MAX_LENGTH} characters.`,
        variant: "destructive",
      });
      return null;
    }

    const slug = slugify(event.slug);
    const slugError = slug ? getEventSlugError(slug) : null;
    if (slugError) {
      toast({ title: "Check the URL slug", description: slugError, variant: "destructive" });
      return null;
    }

    const submissionWindowError = validateSubmissionWindow(
      event.submission_time_start,
      event.submission_time_cutoff
    );
    if (submissionWindowError) {
      toast({
        title: "Check the submission window",
        description: submissionWindowError,
        variant: "destructive",
      });
      return null;
    }

    setCreating(true);
    try {
      const coverError = event.cover_image_file
        ? validateCoverImage(event.cover_image_file)
        : null;
      if (coverError) {
        toast({ title: "Check the cover image", description: coverError, variant: "destructive" });
        return null;
      }
      const organizerEmails = await getOrganizerEmails();

      // Build payload from wizard state
      const payload = buildApiPayload(event);
      payload.event.visibility = visibility;
      payload.organizerEmails = organizerEmails;

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Create failed",
          description: data.error || "Error creating event.",
          variant: "destructive",
        });
        return null;
      }

      const inviteFailureCount =
        getInviteFailureCount(data.inviteSummary) +
        getOrganizerInviteFailureCount(data.organizerInviteSummary);
      if (data.inviteSummary?.deferred) {
        toast({
          title: "Invites not sent",
          description:
            "Participant and judge invite emails are only sent when the event is published.",
        });
      } else if (inviteFailureCount > 0) {
        toast({
          title: "Some invites were not sent",
          description: `${inviteFailureCount} invite email${inviteFailureCount === 1 ? "" : "s"} failed to send.`,
          variant: "destructive",
        });
      }

      await uploadCoverImageForEvent(data.event.event_id);
      await saveSubmissionFields(data.event.event_id);
      return data.event;
    } catch {
      toast({
        title: "Network error",
        description: "Unable to create event.",
        variant: "destructive",
      });
      return null;
    } finally {
      setCreating(false);
    }
  };

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    const created = await createEvent(EventVisibility.Draft);
    if (created) {
      toast({
        title: "Event saved as draft",
        description: `${created.event_name} has been saved.`,
      });
      router.push(`/events/${created.slug || created.event_id}/overview`);
    }
  };

  const handlePublishPrivate = async () => {
    const created = await createEvent(EventVisibility.Private);
    if (created) {
      setCreatedEventId(created.event_id);
      setCreatedEventSlug(created.slug || null);
      setShowApprovalModal(true);
    }
  };

  // Public listing needs admin approval (ORG-002): non-admins get the event
  // created as private (unlisted) and it is submitted for review right away.
  const handlePublishPublic = async () => {
    const created = await createEvent(EventVisibility.Public);
    if (!created) return;
    const href = `/events/${created.slug || created.event_id}/overview`;
    if (created.visibility === EventVisibility.Public) {
      router.push(href);
      return;
    }
    try {
      const res = await fetch("/api/events/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: created.event_id }),
      });
      if (!res.ok) throw new Error("request-approval failed");
      toast({
        title: "Submitted for approval",
        description:
          "Your event is live as a private (unlisted) event and will be listed publicly once an admin approves it.",
      });
    } catch {
      toast({
        title: "Published as private",
        description:
          "Your event was created as a private event, but submitting it for public listing failed. You can request approval from the event page.",
        variant: "destructive",
      });
    }
    router.push(href);
  };

  const handleSubmitForApproval = async () => {
    if (!createdEventId || isNavigating) return;
    setIsNavigating(true);
    setCreating(true);
    try {
      const res = await fetch("/api/events/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: createdEventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsNavigating(false);
        toast({
          title: "Request failed",
          description: data.error || "Error submitting for approval.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Approval requested",
        description:
          "Your event has been submitted for approval to be featured on the home page.",
      });
      setShowApprovalModal(false);
      router.push(`/events/${createdEventSlug || createdEventId}/overview`);
    } catch {
      setIsNavigating(false);
      toast({
        title: "Network error",
        description: "Unable to submit for approval.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSkipApproval = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    setShowApprovalModal(false);
    if (createdEventId) {
      router.push(`/events/${createdEventSlug || createdEventId}/overview`);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="bg-gray-50">
      {/* Header with save/publish buttons */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Create Event
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="rounded-[12px] text-sm"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={creating}
              className="rounded-[12px] border-[rgba(0,0,0,0.15)] text-sm"
            >
              {creating ? "Saving..." : "Save Draft"}
            </Button>
            {isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={creating}
                    className="rounded-[12px] bg-[#4b89ef] text-sm text-white hover:bg-[#4b89ef]/90"
                  >
                    {creating ? "Publishing..." : "Publish"}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePublishPrivate}>
                    Publish as Private
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePublishPublic}>
                    Publish as Public
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={handlePublishPrivate}
                disabled={creating}
                className="rounded-[12px] bg-[#4b89ef] text-sm text-white hover:bg-[#4b89ef]/90"
              >
                {creating ? "Publishing..." : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Wizard */}
      <WizardShell event={event} setEvent={setEvent}>
        {(step) => (
          <>
            {step === 0 && <DetailsStep event={event} setEvent={setEvent} />}
            {step === 1 && (
              <WizardSubmissionStep event={event} setEvent={setEvent} />
            )}
            {step === 2 && (
              <WizardJudgingStep event={event} setEvent={setEvent} />
            )}
            {step === 3 && (
              <WizardInviteStep event={event} setEvent={setEvent} />
            )}
          </>
        )}
      </WizardShell>

      {/* Approval Modal */}
      <AlertDialog
        open={showApprovalModal}
        onOpenChange={(open) => {
          if (!open && !isNavigating) handleSkipApproval();
          else setShowApprovalModal(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event Published</AlertDialogTitle>
            <AlertDialogDescription>
              Your event has been published as a private event. Would you like to
              submit it for approval to be featured on the home page?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipApproval}>
              Skip for now
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitForApproval}
              className="bg-[#4b89ef] hover:bg-[#4b89ef]/90"
            >
              Submit for Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
