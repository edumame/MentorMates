import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Target, BookOpen, TrendingUp, Award } from "lucide-react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import { EngagementNudge } from "@/components/engagement-nudge";

const GoalSection = dynamic(() => import("@/components/journal/goal-section"), {
  ssr: false,
});

const JournalSection = dynamic(
  () => import("@/components/journal/journal-section"),
  {
    ssr: false,
  }
);

interface ParticipantDashboardProps {
  eventId: string;
}

export function ParticipantDashboard({ eventId }: ParticipantDashboardProps) {
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paywalledContent, setPaywalledContent] = useState<string | null>(null);
  const [goalSectionRef, setGoalSectionRef] = useState<HTMLDivElement | null>(null);
  const [journalSectionRef, setJournalSectionRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchMyProjects = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return

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

    fetchMyProjects();
  }, [eventId]);

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

  const scrollToGoals = () => {
    goalSectionRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToJournal = () => {
    journalSectionRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-8 shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome to Your Dashboard! 🚀</h1>
            <p className="text-blue-100 text-lg">
              Track your progress, set goals, and document your journey throughout this event.
            </p>
          </div>
          <Link href={`/events/${eventId}/submit`}>
            <Button className="bg-white text-blue-600 hover:bg-gray-100 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 px-8 py-3 text-lg">
              <Plus className="h-5 w-5" />
              Submit Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Engagement Nudge */}
      <EngagementNudge 
        eventId={eventId}
        onGoalClick={scrollToGoals}
        onJournalClick={scrollToJournal}
      />

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Projects</p>
                <p className="text-2xl font-bold text-green-800">{myProjects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Goals</p>
                <p className="text-2xl font-bold text-blue-800">Track Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-pink-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700">Journal</p>
                <p className="text-2xl font-bold text-purple-800">Reflect & Learn</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-50 to-yellow-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-600 rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700">Growth</p>
                <p className="text-2xl font-bold text-orange-800">Keep Going!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals and Journal - Featured Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Goals Section */}
        <div ref={setGoalSectionRef}>
          <Suspense fallback={
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-100">
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-blue-400 mx-auto mb-4 animate-pulse" />
                <p className="text-blue-600">Loading your goals...</p>
              </CardContent>
            </Card>
          }>
            <GoalSection eventId={eventId} />
          </Suspense>
        </div>

        {/* Journal Section */}
        <div ref={setJournalSectionRef}>
          <Suspense fallback={
            <Card className="bg-gradient-to-br from-purple-50 to-pink-100">
              <CardContent className="p-8 text-center">
                <BookOpen className="h-12 w-12 text-purple-400 mx-auto mb-4 animate-pulse" />
                <p className="text-purple-600">Loading your journal...</p>
              </CardContent>
            </Card>
          }>
            <JournalSection eventId={eventId} />
          </Suspense>
        </div>
      </div>

      {/* Projects Section - Secondary Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              My Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[400px]">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ) : myProjects.length === 0 ? (
              <div className="text-center py-8">
                <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">You haven't submitted any projects yet.</p>
                <Link href={`/events/${eventId}/submit`}>
                  <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-full">
                    Submit Your First Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myProjects.map((project) => (
                  <div key={project.id} className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white p-4 rounded-lg hover:shadow-md transition-all">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block hover:text-blue-600 transition-colors"
                    >
                      <h3 className="font-semibold text-lg text-gray-800">{project.project_name}</h3>
                      <p className="text-gray-600 mt-1 leading-relaxed">
                        {project.project_description}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Submitted on {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Event Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Projects Submitted</h3>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-blue-600">{myProjects.length}</div>
                  <div className="text-sm text-gray-600">
                    {myProjects.length === 0 ? "Get started!" : myProjects.length === 1 ? "Great start!" : "Amazing work!"}
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Engagement Score</h3>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-purple-600">🔥</div>
                  <div className="text-sm text-gray-600">
                    Keep setting goals and journaling to increase your score!
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exclusive Content - Moved to bottom */}
      {paywalledContent && (
        <Card className="border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-yellow-800 flex items-center gap-2">
              🔒 Exclusive Content for Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-blue max-w-none">
              <ReactMarkdown rehypePlugins={markdownRehypePlugins} components={customMarkdownComponents}>{paywalledContent}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
