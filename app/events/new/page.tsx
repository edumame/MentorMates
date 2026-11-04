"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EventCreationChat } from "@/components/events/create-chat/EventCreationChat";

/**
 * Create an event by chatting (no forms). The old step-by-step wizard was
 * removed: everything it collected after the basics (submission form,
 * tracks, judges, invites) is edited on the event's dashboard after Create.
 */
export default function NewEventPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data?.session) {
        router.push("/login");
        return;
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <Suspense>
      <EventCreationChat />
    </Suspense>
  );
}
