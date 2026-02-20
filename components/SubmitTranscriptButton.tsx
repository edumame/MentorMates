"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function SubmitTranscriptButton({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));

  // `data` comes from the meetings.getOne TRPC call; give it a minimal type
  // so TypeScript knows about `status`.
  type MeetingData = { id: string; status?: string } | undefined | null;
  const meetingData = data as unknown as MeetingData;

  const { toast } = useToast();
  const router = useRouter();

  const [hasUserMessages, setHasUserMessages] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchHasUserMessages() {
      try {
        const resp = await fetch("/api/meetings/has-user-messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ meetingId }),
        });
        if (!resp.ok) {
          if (!cancelled) setHasUserMessages(false);
          return;
        }
        const json = await resp.json();
        if (!cancelled) setHasUserMessages(Boolean(json?.hasUserMessages));
      } catch {
        if (!cancelled) setHasUserMessages(false);
      }
    }

    // Initial fetch
    fetchHasUserMessages();

    // Poll every 2 seconds to check for new messages
    const pollInterval = setInterval(() => {
      if (!cancelled) {
        fetchHasUserMessages();
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [meetingId]);

  const isUpcoming = meetingData?.status === "upcoming";
  const displayDone = done || !isUpcoming;
  const disabled = loading || displayDone;
  const label = loading ? "Getting review..." : displayDone ? "Review ready" : "Get review";

  async function handleSubmit() {
    if (loading || !isUpcoming) return;
    if (hasUserMessages === false) {
      toast({ title: "No messages", description: "You need to send a message before submitting the transcript." });
      return;
    }
    if (hasUserMessages === null) {
      // still loading whether user has messages; be conservative
      toast({ title: "Checking messages", description: "Please try again in a moment." });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/meetings/submit-transcript`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });

      if (!resp.ok) throw new Error("failed");
      setDone(true);
      router.push("/learn");
    } catch (e) {
      console.error("submit transcript failed", e);
      alert("Failed to submit transcript");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleSubmit}
      disabled={disabled}
      variant={displayDone ? "defaultGray" : "default"}
      aria-label={label}
      className="!h-9 !px-3 !py-1 text-xs sm:!h-10 sm:!px-4 sm:!py-2 sm:text-base"
    >
      <span className="whitespace-nowrap sm:hidden">
        {loading ? "Loading" : displayDone ? "Reviewed" : "Review"}
      </span>
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </Button>
  );
}
