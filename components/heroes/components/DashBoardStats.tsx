"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CountsState {
  projects: number;
  events: number;
  feedback: number;
}

const svgIcons = {
  calendar: [
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none">
    <path d="M16 2.5V6.5M8 2.5V6.5M3 10.5H21M5 4.5H19C20.1046 4.5 21 5.39543 21 6.5V20.5C21 21.6046 20.1046 22.5 19 22.5H5C3.89543 22.5 3 21.6046 3 20.5V6.5C3 5.39543 3.89543 4.5 5 4.5Z" stroke="#09090B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  ],
  createProject: [
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="21" viewBox="0 0 20 21" fill="none">
    <path d="M9 1.5V9.5L12 6.5L15 9.5V1.5M3 1.5H17C18.1046 1.5 19 2.39543 19 3.5V17.5C19 18.6046 18.1046 19.5 17 19.5H3C1.89543 19.5 1 18.6046 1 17.5V3.5C1 2.39543 1.89543 1.5 3 1.5Z" stroke="#09090B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  ],
  event: [
    <svg xmlns="http://www.w3.org/2000/svg" width="35" height="34" viewBox="0 0 35 34" fill="none">
    <path d="M25.1484 27.2301H22.105C21.7645 27.2301 21.4784 27.1136 21.2465 26.8805C21.0144 26.6475 20.8984 26.3584 20.8984 26.0132C20.8984 25.668 21.0144 25.3809 21.2465 25.1518C21.4784 24.9231 21.7645 24.8087 22.105 24.8087H25.1484V21.765C25.1484 21.4245 25.265 21.1383 25.4983 20.9065C25.7313 20.6746 26.019 20.5587 26.3614 20.5587C26.7035 20.5587 26.9891 20.6746 27.2181 20.9065C27.4472 21.1383 27.5617 21.4245 27.5617 21.765V24.8087H30.605C30.9455 24.8087 31.2317 24.9252 31.4635 25.1582C31.6956 25.3913 31.8117 25.6804 31.8117 26.0256C31.8117 26.3708 31.6956 26.6578 31.4635 26.8866C31.2317 27.1156 30.9455 27.2301 30.605 27.2301H27.5617V30.2649C27.5617 30.6113 27.445 30.9004 27.2118 31.1323C26.9787 31.3642 26.691 31.4801 26.3486 31.4801C26.0065 31.4801 25.7209 31.3642 25.4919 31.1323C25.2629 30.9004 25.1484 30.6113 25.1484 30.2649V27.2301ZM6.952 28.5451C6.30033 28.5451 5.73532 28.3058 5.25696 27.8272C4.77836 27.3489 4.53906 26.7838 4.53906 26.1322V7.15947C4.53906 6.50545 4.77836 5.93842 5.25696 5.45841C5.73532 4.97816 6.30033 4.73804 6.952 4.73804H9.17794V3.82251C9.17794 3.4837 9.29552 3.19741 9.53069 2.96366C9.76609 2.72991 10.0523 2.61304 10.3892 2.61304C10.736 2.61304 11.0286 2.72991 11.2668 2.96366C11.505 3.19741 11.6242 3.4837 11.6242 3.82251V4.73804H20.5442V3.82251C20.5442 3.4837 20.6619 3.19741 20.8973 2.96366C21.1325 2.72991 21.4185 2.61304 21.7555 2.61304C22.1025 2.61304 22.3951 2.72991 22.6331 2.96366C22.8713 3.19741 22.9904 3.4837 22.9904 3.82251V4.73804H25.2164C25.8704 4.73804 26.4374 4.97816 26.9174 5.45841C27.3977 5.93842 27.6378 6.50545 27.6378 7.15947V16.4663C27.6378 16.8126 27.5196 17.1018 27.2833 17.3336C27.0467 17.5655 26.7576 17.6814 26.4159 17.6814C26.074 17.6814 25.7886 17.5655 25.5596 17.3336C25.3308 17.1018 25.2164 16.8126 25.2164 16.4663V13.8125H6.952V26.1322H16.8333C17.1733 26.1322 17.4607 26.2487 17.6956 26.4817C17.9308 26.7148 18.0484 27.0025 18.0484 27.3448C18.0484 27.6872 17.9308 27.9728 17.6956 28.2016C17.4607 28.4306 17.1733 28.5451 16.8333 28.5451H6.952ZM6.952 11.6875H25.2164V7.15947H6.952V11.6875Z" fill="#528EF0"/>
    </svg>
  ],
  feedback: [
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none">
    <path d="M18 9.5H20C20.5304 9.5 21.0391 9.71071 21.4142 10.0858C21.7893 10.4609 22 10.9696 22 11.5V22.5L18 18.5H12C11.4696 18.5 10.9609 18.2893 10.5858 17.9142C10.2107 17.5391 10 17.0304 10 16.5V15.5M14 9.5C14 10.0304 13.7893 10.5391 13.4142 10.9142C13.0391 11.2893 12.5304 11.5 12 11.5H6L2 15.5V4.5C2 3.4 2.9 2.5 4 2.5H12C12.5304 2.5 13.0391 2.71071 13.4142 3.08579C13.7893 3.46086 14 3.96957 14 4.5V9.5Z" stroke="#09090B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  ],
  album: [
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none">
    <path d="M11 3.5V11.5L14 8.5L17 11.5V3.5M5 3.5H19C20.1046 3.5 21 4.39543 21 5.5V19.5C21 20.6046 20.1046 21.5 19 21.5H5C3.89543 21.5 3 20.6046 3 19.5V5.5C3 4.39543 3.89543 3.5 5 3.5Z" stroke="#09090B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  ],
};

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
          .or(
            `lead_email.eq.${session.user.email},teammates.cs.{${session.user.email}}`
          );

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
        label: "Events attended",
        value: counts.events,
        icon: svgIcons.calendar[0],
      },
      {
        label: "My projects",
        value: counts.projects,
        icon: svgIcons.createProject[0],
      },
      {
        label: "Feedback received",
        value: counts.feedback,
        icon: svgIcons.feedback[0],
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
                      {svgIcons.event[0]}
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
                      {svgIcons.createProject[0]}
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
                <div className="flex flex-col items-left gap-2 text-gray-800">
                  <span className="h-6 w-6 items-center justify-center">
                    {stat.icon}
                  </span>
                  <span className="text-md">{stat.label}</span>
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
