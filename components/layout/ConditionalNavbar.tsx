"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AuthNavbar } from "./AuthNavbar";
import { Navbar } from "./Navbar";
import { useLayoutConfig } from "./LayoutConfigProvider";

const AUTH_ROUTE_PREFIXES = ["/login", "/signup", "/auth"];

export function ConditionalNavbar() {
  const pathname = usePathname();
  const { showNavbar } = useLayoutConfig();

  // 1) Never render on auth routes
  const isAuthRoute =
    !pathname
      ? false
      : AUTH_ROUTE_PREFIXES.some((p) =>
          pathname === p || pathname.startsWith(`${p}/`)
        );

  if (isAuthRoute || !showNavbar) {
    return null;
  }

  // 2) For non-auth routes, render based on session
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(session);
        setIsLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (isMounted) {
        setSession(newSession);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // While resolving session, render nothing to avoid flash (or swap this for a skeleton if you prefer)
  if (isLoading) return null;

  return session ? <AuthNavbar /> : <Navbar />;
}
