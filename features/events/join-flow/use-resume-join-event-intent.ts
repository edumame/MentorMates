"use client";

import { useEffect, useRef } from "react";

import {
  JoinEventIntent,
  readJoinEventIntent,
} from "@/features/events/join-flow/join-event-intent";

interface UseResumeJoinEventIntentOptions {
  eventId: string;
  enabled: boolean;
  onResume: (intent: JoinEventIntent) => void;
}

export function useResumeJoinEventIntent({
  eventId,
  enabled,
  onResume,
}: UseResumeJoinEventIntentOptions) {
  const hasResumedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasResumedRef.current) return;

    const intent = readJoinEventIntent();
    if (intent?.eventId !== eventId) return;

    hasResumedRef.current = true;
    onResume(intent);
  }, [enabled, eventId, onResume]);
}
