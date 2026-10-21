"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import posthog from "posthog-js";
import { AuthHero } from "@/components/heroes/AuthHero";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

/**
 * Client-side wrapper that handles authenticated user routing.
 * When a user is logged in, shows the auth dashboard instead of the
 * server-rendered landing page.
 *
 * The `children` prop contains the server-rendered landing page content,
 * which is shown to unauthenticated users (and is already in the HTML
 * for search engine crawlers).
 */
export function HomePageClient({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const hasSyncedRef = useRef(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Match the server landing HTML even when the browser has a cached session.
  useEffect(() => { setHasMounted(true); }, []);

  useEffect(() => {
    const syncUserProfile = async () => {
      if (!session?.user || hasSyncedRef.current) return;
      hasSyncedRef.current = true;

      try {
        const user = session.user;

        const profileData = {
          uid: user.id,
          email: user.email,
          display_name: user.user_metadata.full_name,
        };

        const { error } = await supabase
          .from("user_profiles")
          .upsert(profileData, {
            onConflict: "email",
          })
          .select();

        if (error) {
          const msg = error.message ?? String(error);
          const code = (error as { code?: string }).code;
          console.error("Error syncing profile:", code ? `[${code}] ${msg}` : msg);
        }

        posthog.identify(user.id, {
          email: user.email,
          display_name: user.user_metadata.full_name,
        });
      } catch (error) {
        console.error("Error in syncUserProfile:", error);
      }
    };

    syncUserProfile();
  }, [session]);

  // Authenticated: show dashboard
  if (hasMounted && session) {
    return (
      <SidebarLayout showLogoInSidebar>
        <AuthHero />
        <ServiceWorkerRegistration />
      </SidebarLayout>
    );
  }

  // Unauthenticated: render the server-rendered landing page content
  return <>{children}</>;
}
