"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { LandingHero } from "@/components/heroes/LandingHero";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { motion } from "framer-motion";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { Footer } from "@/components/layout/Footer";
import { Calendar, Folder, MessageSquare } from "lucide-react";

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState({ events: 0, projects: 0, feedback: 0 });

  // Get session and sync basic profile
  useEffect(() => {
    (async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (currentSession?.user) {
        const u = currentSession.user;
        await supabase.from("user_profiles").upsert(
          {
            uid: u.id,
            email: u.email,
            display_name: u.user_metadata?.full_name ?? null,
          },
          { onConflict: "email" }
        );
      }

      setSession(currentSession ?? null);
      setLoading(false);
    })();
  }, []);

  // Fetch stats for the signed-in user
  useEffect(() => {
    if (!session?.user) return;

    (async () => {
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
        new Set([...(lead ?? []), ...(team ?? [])].map((p: { id: string }) => p.id))
      );
      const projectsCount = projectIds.length;

      // FEEDBACK RECEIVED
      const { data: userFeedback } = await supabase
        .from("feedback")
        .select("*")
        .in(
          "project_id",
          combinedProjects.map((project) => project.id)
        );

      const totalFeedbackCount = userFeedback?.length || 0;

      // Save to state
      setTotalEvents(totalEventsCount);
      setSubmittedProjects(submittedProjectsCount);
      setFeedbackCount(totalFeedbackCount);

      setIsLoadingStats(false);
    };

    if (session?.user?.email) {
      fetchStats();
    }
  }, [session]);

  if (loading) return null;

  if (!session) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-white to-blue-50 pb-4">
        <AnnouncementBanner href={bookUrl} />
        <LandingHero />
        <ServiceWorkerRegistration />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-50">
      <AnnouncementBanner href={bookUrl} />
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-blue-900 mb-2">
            Welcome to MentorMates
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl font-light mb-6">
            Find your event to start getting personalized feedback and guidance
            for your projects.
          </p>

          {/* Stats */}
          {loadingStats ? (
            <div className="h-20 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Loading stats...</p>
            </div>
          ) : (
            <div className="flex items-center justify-around mb-4 text-blue-900">
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-sm">Events</span>
                <span className="text-xl">{stats.events}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-sm">Projects</span>
                <span className="text-xl">{stats.projects}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-sm">Feedback</span>
                <span className="text-xl">{stats.feedback}</span>
              </div>
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 px-4">
            <div className="bg-white shadow rounded-lg p-6 flex flex-col">
              <div className="flex items-center mb-4">
                <Calendar className="w-8 h-8 text-blue-900 mr-2" />
                <h2 className="text-xl font-bold text-blue-900">Events</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base mb-4">
                Check your upcoming events or create new ones.
              </p>
              <Link href="/events" className="mt-auto">
                <Button className="bg-blue-900 text-white w-full sm:w-auto">
                  View Events
                </Button>
              </Link>
            </div>

            <div className="bg-white shadow rounded-lg p-6 flex flex-col">
              <div className="flex items-center mb-4">
                <Folder className="w-8 h-8 text-blue-900 mr-2" />
                <h2 className="text-xl font-bold text-blue-900">Projects</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base mb-4">
                Track and update your project progress.
              </p>
              <Link href="/projects" className="mt-auto">
                <Button className="bg-blue-900 text-white w-full sm:w-auto">
                  View Projects
                </Button>
              </Link>
            </div>

            <div className="bg-white shadow rounded-lg p-6 flex flex-col">
              <div className="flex items-center mb-4">
                <MessageSquare className="w-8 h-8 text-blue-900 mr-2" />
                <h2 className="text-xl font-bold text-blue-900">Feedback</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base mb-4">
                Review the feedback you have provided.
              </p>
              <Link href="/feedback/given" className="mt-auto">
                <Button className="bg-blue-900 text-white w-full sm:w-auto">
                  View Feedback
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ServiceWorkerRegistration />
      <Footer />
    </div>
  );
}
