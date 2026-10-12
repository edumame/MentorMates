"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function AuthRedirectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Tracks the authenticated user across auth events. `undefined` means we
  // haven't seen an event yet; `null` means signed out.
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") {
        return;
      }

      // supabase-js re-fires SIGNED_IN on tab focus and on every token refresh,
      // not just on a real login. Calling router.refresh() on each of those
      // spins an endless reload loop, so only refresh when the authenticated
      // user actually changes (signed out -> in, in -> out, or a new user).
      const userId = session?.user?.id ?? null;
      if (lastUserIdRef.current === userId) {
        return;
      }
      lastUserIdRef.current = userId;
      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
