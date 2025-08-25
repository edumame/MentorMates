import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, Ticket } from "lucide-react";
import dynamic from "next/dynamic";

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
  () => import("@/components/tickets/view-tickets-tab").then(mod => ({ default: mod.ViewTicketsTab })),
  {
    ssr: false,
  }
);

interface ParticipantDashboardProps {
  eventId: string;
}

interface EventInfo {
  paid: boolean | null;
}

export function ParticipantDashboard({ eventId }: ParticipantDashboardProps) {
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("projects");

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return

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
        console.error("Error fetching projects:", leadProjectsError || teamProjectsError);
      } else {
        setMyProjects(allProjects || []);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [eventId]);

  const isPaidEvent = eventInfo?.paid === true;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Participant Dashboard</h2>
        <Link href={`/events/${eventId}/submit`}>
          <Button className="button-gradient text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Submit Project
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${isPaidEvent ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Projects
          </TabsTrigger>
          {isPaidEvent && (
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              View Tickets
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>My Projects</CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[500px]">
                {isLoading ? (
                  <p>Loading...</p>
                ) : myProjects.length === 0 ? (
                  <p>You haven&apos;t submitted any projects yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {myProjects.map((project) => (
                      <li key={project.id} className="border-b pb-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="hover:text-blue-500"
                        >
                          <h3 className="font-semibold">{project.project_name}</h3>
                          <p className="text-sm text-gray-600">
                            {project.project_description}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">Projects Submitted</h3>
                    <p className="text-2xl">{myProjects.length}</p>
                  </div>
                  {/* Add more progress metrics here */}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Goals Section */}
          <Suspense fallback={<div>Loading goals...</div>}>
            <GoalSection eventId={eventId} />
          </Suspense>

          {/* Journal Section */}
          <Suspense fallback={<div>Loading journal...</div>}>
            <JournalSection eventId={eventId} />
          </Suspense>
        </TabsContent>

        {isPaidEvent && (
          <TabsContent value="tickets">
            <Suspense fallback={<div>Loading tickets...</div>}>
              <ViewTicketsTab eventId={eventId} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
