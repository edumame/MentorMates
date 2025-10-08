"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarMonth,
  Assignment,
  Feedback,
  EventAvailable,
  BuildCircle,
} from "@mui/icons-material";
import Link from "next/link";

interface CountsState {
  projects: number;
  events: number;
  feedback: number;
}

export function DashBoardStats() {
  const [counts, setCounts] = useState<CountsState>({
    projects: 0,
    events: 0,
    feedback: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchPersonalCounts = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setCounts({ projects: 0, events: 0, feedback: 0 });
          return;
        }

        const userId = session.user.id;

        const { count: ownerCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("lead_email", session.user.email);
        
        const { count: teammateCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .contains("teammates", [session.user.email]);
        
        const projectsCount = (ownerCount ?? 0) + (teammateCount ?? 0);

        const { count: eventsCount } = await supabase
          .from("user_event_roles")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        
        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .or(`lead_email.eq.${session.user.email},teammates.cs.{${session.user.email}}`);

        const projectIds = projects?.map((project) => project.id);

        const { count: feedbackCount } = await supabase
          .from("feedback")
          .select("*", { count: "exact", head: true })
          .in("project_id", projectIds || []);

        setCounts({
          projects: projectsCount ?? 0,
          events: eventsCount ?? 0,
          feedback: feedbackCount ?? 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalCounts();

    const channel = supabase
      .channel("dashboard-stats-personal")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        fetchPersonalCounts
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_participants" },
        fetchPersonalCounts
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback" },
        fetchPersonalCounts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(
    () => [
      {
        label: "My projects",
        value: counts.projects,
        icon: <Assignment fontSize="small" />,
      },
      {
        label: "Events attended",
        value: counts.events,
        icon: <CalendarMonth fontSize="small" />,
      },
      {
        label: "Feedback received",
        value: counts.feedback,
        icon: <Feedback fontSize="small" />,
      },
    ],
    [counts]
  );

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <div className="relative grid gap-3">
            <Card className="border border-gray-200 shadow-none hover:shadow-sm transition">
              <CardContent className="py-4 px-4">
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto w-full justify-start px-0"
                >
                  <Link href="/events" className="flex items-center gap-3">
                    <span className="inline-grid h-9 w-9 place-items-center rounded-md bg-blue-50 ring-1 ring-blue-100">
                      <EventAvailable
                        className="text-blue-500"
                        fontSize="small"
                      />
                    </span>
                    <span className="text-[15px] font-medium text-gray-800">
                      Join an event
                    </span>
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-none hover:shadow-sm transition">
              <CardContent className="py-4 px-4">
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto w-full justify-start px-0"
                >
                  <Link
                    href="/projects/new"
                    className="flex items-center gap-3"
                  >
                    <span className="inline-grid h-9 w-9 place-items-center rounded-md bg-blue-50 ring-1 ring-blue-100">
                      <BuildCircle className="text-blue-500" fontSize="small" />
                    </span>
                    <span className="text-[15px] font-medium text-gray-800">
                      Create a project
                    </span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right stat cards */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="border border-gray-200 rounded-xl shadow-none hover:shadow-sm transition"
            >
              <CardContent className="px-4 py-4">
                <div className="flex items-center gap-2 text-gray-800">
                  <span className="inline-flex h-6 w-6 items-center justify-center">
                    {stat.icon}
                  </span>
                  <span className="text-xs text-gray-700">{stat.label}</span>
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                  {loading ? (
                    <span className="inline-block h-7 w-10 rounded bg-gray-200 animate-pulse" />
                  ) : (
                    stat.value
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
