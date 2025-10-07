"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";

export function ConditionalAnnouncement() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setMounted(true);

    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!mounted) return null; // prevent SSR/client mismatch flash
  if (pathname !== "/") return null;
  if (session) return null; // Don't show for logged-in users

  return <AnnouncementBanner />;
}
