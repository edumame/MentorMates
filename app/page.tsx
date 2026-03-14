"use client";

import { useEffect, useRef } from "react";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { supabase } from "@/lib/supabase";
import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/heroes/LandingHero";
import posthog from "posthog-js";
import { AuthHero } from "@/components/heroes/AuthHero";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

export default function HomePage() {
  // Use the shared auth context instead of managing own state
  const { session, isLoading } = useAuth();
  const hasSyncedRef = useRef(false);

  // Sync user profile only once when session becomes available
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

  // AuthContext initializes from sessionStorage, so we can show content immediately
  // Only show loading state briefly on first load when there's no cached session
  if (isLoading && !session) {
    return null;
  }

  if (!session) {
    return (
      <div className="min-h-screen w-full">
        <LandingHero />
        <ServiceWorkerRegistration />
        <Footer />
      </div>
    );
  }

  return (
    <SidebarLayout showLogoInSidebar>
      <AuthHero />
      <ServiceWorkerRegistration />
    </SidebarLayout>
  );
}
