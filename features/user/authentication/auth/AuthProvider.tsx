"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PathPattern = string | RegExp;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
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
    const checkAuth = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      setIsLoading(false);

      // Only redirect if (not authenticated or error) and not on a public path
      if ((!session || error) && !isPublicPath(pathname)) {
        router.push("/");
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !isPublicPath(pathname)) {
        router.push("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, isPublicPath]);

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
}
