"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/heroes/LandingHero";
import { Calendar, MessageSquare } from "lucide-react";
import { EventsList } from "@/components/events/events-list";
import { EventItem, EventVisibility } from "@/lib/types";
import posthog from "posthog-js";

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState({ events: 0, projects: 0, feedback: 0 });
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);

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

  // Fetch upcoming events for the landing page
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        setLoadingEvents(true);
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .in("visibility", [EventVisibility.Public, EventVisibility.Private])
          .gte("event_date", nowIso)
          .order("event_date", { ascending: true });

        if (error) {
          console.error("Error fetching upcoming events:", error);
          setEvents([]);
        } else {
          setEvents((data as unknown as EventItem[]) || []);
        }
      } catch (err) {
        console.error("Unexpected error fetching events:", err);
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchUpcomingEvents();
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-blue-900 mb-6">Upcoming Events</h2>
          {loadingEvents ? (
            <div className="h-20 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Loading events...</p>
            </div>
          ) : events.length > 0 ? (
            <EventsList events={events} />
          ) : (
            <p className="text-gray-600">No upcoming events found.</p>
          )}
        </div>
        <ServiceWorkerRegistration />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32">
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

          {/* Upcoming Events Section */}
          <div className="px-4 mt-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Calendar className="w-6 h-6 text-blue-900 mr-2" />
                  <h2 className="text-xl font-bold text-blue-900">Upcoming Events</h2>
                </div>
                <Link href="/events">
                  <Button variant="secondary">Browse all</Button>
                </Link>
              </div>
              {loadingEvents ? (
                <div className="h-20 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Loading events...</p>
                </div>
              ) : events.length > 0 ? (
                <EventsList events={events} />
              ) : (
                <p className="text-gray-600">No upcoming events found.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ServiceWorkerRegistration />
      <Footer />
    </div>
  );
}
