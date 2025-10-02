"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/heroes/LandingHero";
import { Calendar, Folder, MessageSquare } from "lucide-react";
import posthog from "posthog-js";
import { AuthHero } from "@/components/heroes/AutHero";
import { SidebarLayout } from "@/components/layout/SidebarLayout";


export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState({ events: 0, projects: 0, feedback: 0 });

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
          } else {
            console.log("Successfully synced profile.");
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

  // Fetch stats for the signed-in user
  useEffect(() => {
    if (!session?.user) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      const userId = session.user.id;
      const userEmail = session.user.email!;

      // Total events
      const { data: userEventRoles } = await supabase
        .from("user_event_roles")
        .select("event_id")
        .eq("user_id", userId);

      const eventsCount = userEventRoles?.length ?? 0;

      // Submitted projects (lead or teammate)
      const [{ data: lead }, { data: team }] = await Promise.all([
        supabase
          .from("projects")
          .select("id")
          .eq("lead_email", userEmail)
          .eq("submitted", true),
        supabase
          .from("projects")
          .select("id")
          .contains("teammates", [userEmail])
          .eq("submitted", true),
      ]);

      const projectIds = Array.from(
        new Set(
          [...(lead ?? []), ...(team ?? [])].map((p: { id: string }) => p.id)
        )
      );
      const projectsCount = projectIds.length;

      // FEEDBACK RECEIVED
      const { data: userFeedback } = await supabase
        .from("feedback")
        .select("*")
        .in("project_id", projectIds);

      const totalFeedbackCount = userFeedback?.length || 0;

      // Save to state
      setStats({
        events: eventsCount,
        projects: projectsCount,
        feedback: totalFeedbackCount,
      });

      setLoadingStats(false);
    };

    if (session?.user?.email) {
      fetchStats();
    }
  }, [session]);

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
      {/* <Footer /> */}
    </SidebarLayout>
  );
}
