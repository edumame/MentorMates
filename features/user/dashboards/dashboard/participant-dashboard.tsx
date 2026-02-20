import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen, ConfirmationNumber, BarChart } from "@mui/icons-material";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import { useHasJoinedEvent } from "@/lib/hooks/use-has-joined-event";
import { Loader2 } from "lucide-react";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";

const ProjectsTab = dynamic(
  () =>
    import("../participant/ProjectsTab").then((mod) => ({
      default: mod.ProjectsTab,
    })),
  {
    ssr: false,
  }
);

const GoalSection = dynamic(() => import("@/components/journal/goal-section"), {
  ssr: false,
});

const JournalSection = dynamic(
  () => import("@/components/journal/journal-section"),
  {
    ssr: false,
  }
);

const ViewTicketsTab = dynamic(
  () =>
    import("@/components/tickets/view-tickets-tab").then((mod) => ({
      default: mod.ViewTicketsTab,
    })),
  {
    ssr: false,
  }
);

interface ParticipantDashboardProps {
  eventId: string;
  canCreateProjects?: boolean;
}

interface EventInfo {
  paid: boolean | null;
}

export function ParticipantDashboard({ eventId, canCreateProjects = true }: ParticipantDashboardProps) {
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("projects");
  const { hasJoined } = useHasJoinedEvent(eventId);

  const [paywalledContent, setPaywalledContent] = useState<string | null>(null);
  const [goalsCount, setGoalsCount] = useState<number>(0);
  const [journalCount, setJournalCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch event info to check if it's paid
      const { data: event } = await supabase
        .from("events")
        .select("paid")
        .eq("event_id", eventId)
        .single();

      setEventInfo(event);

      const { data: leadProjects, error: leadProjectsError } = await supabase
        .from("projects")
        .select()
        .eq("lead_email", session.user.email)
        .eq("event_id", eventId);

      //problem: teammates are not being stored as emails. This fetch will not work.
      const { data: teamProjects, error: teamProjectsError } = await supabase
        .from("projects")
        .select()
        .contains("teammates", [session.user.email])
        .eq("event_id", eventId);

      const allProjects = [...(leadProjects || []), ...(teamProjects || [])]
        .filter(
          (project, index, self) =>
            index === self.findIndex((p) => p.id === project.id)
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      if (leadProjectsError || teamProjectsError) {
        console.error(
          "Error fetching projects:",
          leadProjectsError || teamProjectsError
        );
      } else {
        setMyProjects(allProjects || []);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [eventId]);

  const isPaidEvent = eventInfo?.paid === true;
  useEffect(() => {
    const fetchEventPaywall = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("paywall_content")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching event paywalled content:", error);
        return;
      }
      setPaywalledContent(data?.paywall_content ?? null);
    };

    fetchEventPaywall();
  }, [eventId]);

  useEffect(() => {
    const fetchStats = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id;

      const { count: gCount } = await supabase
        .from("platform_engagement")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("type", "goal")
        .eq("user_id", userId);

      const { count: jCount } = await supabase
        .from("platform_engagement")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("type", "journal")
        .eq("user_id", userId);

      setGoalsCount(gCount || 0);
      setJournalCount(jCount || 0);

      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data: activity } = await supabase
        .from("platform_engagement")
        .select("created_at,type")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .gte("created_at", since.toISOString());

      const daysSet = new Set<string>();
      (activity || []).forEach((a: { created_at: string; type: string }) => {
        const d = new Date(a.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        daysSet.add(key);
      });
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (daysSet.has(key)) streak++;
        else break;
      }
      setStreakDays(streak);
    };

    fetchStats();
  }, [eventId]);

  return (
    <PageContainer>
      <PageContent className="px-[32px] pt-[24px]">
        <div className="flex flex-col gap-[48px] max-w-[1064px] mx-auto">
      <h2 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">Participant Dashboard</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className={`grid w-full ${
            isPaidEvent ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="focus" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Focus
          </TabsTrigger>
          {isPaidEvent && (
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <ConfirmationNumber className="h-4 w-4" />
              View Tickets
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="projects">
          <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-blue-900" />}>
            <ProjectsTab
              eventId={eventId}
              myProjects={myProjects}
              setMyProjects={setMyProjects}
              isLoading={isLoading}
              canCreateProjects={canCreateProjects}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="focus">
          <Card className="w-full bg-white shadow-lg rounded-xl">
            <CardContent className="p-0">
              <Tabs defaultValue="goals" className="w-full">
                <div className="p-4">
                  <TabsList>
                    <TabsTrigger value="goals">Goals</TabsTrigger>
                    <TabsTrigger value="journal">Journal</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="goals" className="p-4">
                  <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-blue-900" />}>
                    <GoalSection eventId={eventId} hideHeader />
                  </Suspense>
                </TabsContent>
                <TabsContent value="journal" className="p-4">
                  <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-blue-900" />}>
                    <JournalSection eventId={eventId} hideHeader />
                  </Suspense>
                </TabsContent>
                <TabsContent value="stats" className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Goals Set</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{goalsCount}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Journal Entries</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{journalCount}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Streak</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{streakDays}d</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {hasJoined && paywalledContent && (
            <Card className="border-2 border-yellow-200 bg-yellow-50 mt-6">
              <CardHeader>
                <CardTitle className="text-yellow-800">
                  🔒 Exclusive Content for Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-blue max-w-none">
                  <ReactMarkdown
                    rehypePlugins={markdownRehypePlugins}
                    components={customMarkdownComponents}
                  >
                    {paywalledContent}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isPaidEvent && (
          <TabsContent value="tickets">
            <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-blue-900" />}>
              <ViewTicketsTab eventId={eventId} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
        </div>
      </PageContent>
    </PageContainer>
  );
}
