"use client";

import { useEffect, useState } from "react";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/heroes/LandingHero";
import posthog from "posthog-js";
import { AuthHero } from "@/components/heroes/AuthHero";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Get session and sync basic profile

  useEffect(() => {
    const syncUserProfile = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession?.user) {
          const user = currentSession.user;

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
        }

        setSession(currentSession);
        setLoading(false);
      } catch (error) {
        console.error("Error in syncUserProfile:", error);
        setLoading(false);
      }
    };

    syncUserProfile();
  }, []);

  if (loading) return null;

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
    <SidebarLayout>
      <AuthHero />
      <ServiceWorkerRegistration />
    </SidebarLayout>
  );
}
