"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PathPattern = string | RegExp;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticatedPath, setAuthenticatedPath] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Define public paths that don't require authentication using useMemo
  const PUBLIC_PATH_PATTERNS = useMemo(() => {
    const BASE_PUBLIC_PATHS = [
      "/",
      "/project",
      "/projects",
      "/login",
      "/auth/callback",
      "/auth/auth-code-error",
      "/about",
      "/research",
      "/host",
      "/teams",
      "/privacy",
      "/terms",
      "/confirmation",
      "/previous-contributors",
      "/curriculum",
      "/claim-ticket",
      "/join-project",
      "/help",
      "/devpost-integration",
      "/faq",
      "/support",
    ];
    return [
      ...BASE_PUBLIC_PATHS,
      /^\/join($|\/.*$)/, // Matches /join and all its sub-routes
      /^\/projects\/public($|\/.*$)/, // Matches /projects/public and all its sub-routes
      /^\/events($|\/.*$)/, // Matches /events and all its sub-routes
      /^\/ai-vibe-guide($|\/.*$)/, // Matches /ai-vibe-guide and all sub-routes
      /^\/ai-vibe-masterclass($|\/.*$)/, // Matches /ai-vibe-masterclass and all sub-routes
      /^\/profile\/[a-zA-Z0-9_-]+($|\/.*$)/, // Matches /profile/user-id and all its sub-routes
      /^\/blog($|\/.*$)/, // Make blog index and all posts public
      /^\/article($|\/.*$)/, // Alias article routes public too
      /^\/certificate($|\/.*$)/, // Certificates are shareable logged-out (per-person via ?p=)
    ];
  }, []);

  // Wrap isPublicPath in useCallback to prevent recreation on each render
  const isPublicPath = useCallback(
    (path: string) => {
      return PUBLIC_PATH_PATTERNS.some((pattern: PathPattern) =>
        typeof pattern === "string" ? pattern === path : pattern.test(path)
      );
    },
    [PUBLIC_PATH_PATTERNS]
  );

  useEffect(() => {
    let active = true;
    // Auth events supersede an older in-flight session lookup.
    let authEventReceived = false;
    const applySession = (authenticated: boolean) => {
      if (!active) return;
      setAuthenticatedPath(authenticated ? pathname : null);
      if (!authenticated && !isPublicPath(pathname)) router.push("/");
    };

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!authEventReceived) applySession(Boolean(session) && !error);
      } catch {
        if (!authEventReceived) applySession(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      applySession(Boolean(session));
    });
    checkAuth();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router, isPublicPath]);

  // Public pages must be present in the initial HTML before effects resolve auth.
  // Protected pages stay hidden until this path has an authenticated session,
  // including while a signed-out visitor is being redirected.
  if (!isPublicPath(pathname) && authenticatedPath !== pathname) return null;

  return <>{children}</>;
}
