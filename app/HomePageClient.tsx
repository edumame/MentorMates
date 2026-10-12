"use client";

import { useEffect, useRef } from "react";
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
  const { session, isLoading } = useAuth();
  const hasSyncedRef = useRef(false);

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
          console.error("Error syncing profile:", error);
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

  // Show nothing briefly while auth state initializes (no cached session)
  if (isLoading && !session) {
    return null;
  }

  // Authenticated: show dashboard
  if (session) {
    return (
      <SidebarLayout>
        <AuthHero />
        <ServiceWorkerRegistration />
      </SidebarLayout>
    );
  }

  // Unauthenticated: render the server-rendered landing page content
  return <>{children}</>;
}
