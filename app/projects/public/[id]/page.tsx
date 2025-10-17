"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Calendar,
  Heart,
  Loader,
  MapPin,
  ArrowUpRight,
  Video as VideoIcon,
  Download,
  Copy,
  Share2,
  Link as LinkIcon,
  Scale,
  MessageSquare,
  Lightbulb,
} from "lucide-react";
import FeedbackDisplay from "@/features/projects/components/feedback/FeedbackDisplay";
import FeedbackForm from "@/features/projects/components/feedback/FeedbackForm";
import { GiveFeedbackDialog } from "@/features/projects/components/feedback/GiveFeedbackDialog";
import { useQRCodeActions } from "@/features/projects/components/management/project-dashboard/hooks/useQRCodeActions";
import { useProjectLike } from "@/features/projects/hooks/use-project-like";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ProjectScoringForm } from "@/components/project-scoring/project-scoring-form";
import { EventRole, EventTrack, TrackScoringConfig } from "@/lib/types";
import { VideoEmbed, canEmbed } from "@/components/utils";
import { canAccessRole } from "@/features/user/roles/roles";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";

//REFACTOR this to use the Project type from the lib/types.ts file
interface Project {
  id: string;
  project_name: string;
  project_description: string;
  lead_name: string;
  lead_email: string;
  teammates: string[];
  project_url: string | null;
  video_url: string | null;
  additional_materials_url: string | null;
  cover_image_url: string | null;
  created_at: string;
  event_id: string;
}

interface EventDetails {
  event_id: string;
  event_name: string;
  slug: string;
  start_date: string;
  end_date: string;
  location?: string;
  cover_image_url?: string;
}

export default function PublicProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJudge, setIsJudge] = useState(false);
  const [isCheckingJudgeStatus, setIsCheckingJudgeStatus] = useState(false);
  const [projectTracks, setProjectTracks] = useState<EventTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  // QR Code functionality
  const { handleCopyQR, handleDownloadQR } = useQRCodeActions(
    project?.event_id || "",
    projectId,
    project?.project_name
  );

  const { liked, count: likesCount, isLoading: likeIsLoading, toggleLike } = useProjectLike(projectId);

  useEffect(() => {
    const fetchProject = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("submitted", true)
        .single();

      if (error) {
        // Error handled
      } else {
        setProject(data);
      }
      setIsLoading(false);
    };

    fetchProject();
  }, [projectId]);

  // Fetch event details when project is loaded
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!project?.event_id) return;

      try {
        const { data: eventData, error } = await supabase
          .from("events")
          .select("event_id, event_name, slug, event_date, location, cover_image_url")
          .eq("event_id", project.event_id)
          .single();

        if (error) {
          // Error handled
        } else if (eventData) {
          setEventDetails({
            event_id: eventData.event_id,
            event_name: eventData.event_name,
            slug: eventData.slug || "",
            start_date: eventData.event_date,
            end_date: eventData.event_date,
            location: eventData.location || undefined,
            cover_image_url: eventData.cover_image_url || undefined,
          });
        }
      } catch (error) {
        // Error handled
      }
    };

    fetchEventDetails();
  }, [project?.event_id]);

  // Check if user is a judge for this event
  useEffect(() => {
    const checkJudgeStatus = async () => {
      if (!project?.event_id) return;

      setIsCheckingJudgeStatus(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setIsJudge(false);
          setIsCheckingJudgeStatus(false);
          return;
        }

        const { data: roleData, error } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("event_id", project.event_id)
          .single();

        if (error) {
          setIsJudge(false);
          setIsCheckingJudgeStatus(false);
          return;
        }

        const judgeStatus =
          canAccessRole(roleData?.role as EventRole, EventRole.Judge);
        setIsJudge(judgeStatus);

        // Fetch project tracks if user is a judge
        if (judgeStatus && project?.id) {
          try {
            const { data: tracks, error: tracksError } = await supabase
              .from("project_tracks")
              .select(
                `
                track_id,
                event_tracks (
                  track_id,
                  event_id,
                  name,
                  description,
                  scoring_criteria
                )
              `
              )
              .eq("project_id", project.id)
              .overrideTypes<
                {
                  track_id: string;
                  event_tracks: EventTrack;
                }[]
              >();

            if (tracksError) {
              // Error handled
            } else {
              const extractedTracks: EventTrack[] = tracks.map(
                (track) => track.event_tracks
              );
              setProjectTracks(extractedTracks);

              if (extractedTracks && extractedTracks.length > 0) {
                setSelectedTrackId(extractedTracks[0].track_id);
              }
            }
          } catch (tracksError) {
            // Error handled
          }
        }
      } catch (error) {
        setIsJudge(false);
      } finally {
        setIsCheckingJudgeStatus(false);
      }
    };

    checkJudgeStatus();
  }, [project?.event_id, project?.id]);

  const handleScoreSubmitted = () => {
    toast({
      title: "Score Submitted",
      description: "Your score has been successfully submitted.",
    });
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <div className="text-lg">Loading project...</div>
        </div>
      </PageContainer>
    );
  }

  if (!project) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Project not found</h1>
            <p className="text-gray-600 mb-4">
              This project may be private or no longer exists.
            </p>
            <Link href="/projects">
              <Button>Browse Projects</Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  const totalMembers = (project.teammates?.length || 0) + 1;
  const feedbackUrl = typeof window !== "undefined" ? window.location.href : "";
  const selectedTrack = projectTracks.find(
    (track) => track.track_id === selectedTrackId
  );

  return (
    <PageContainer>
      <Toaster />
      <PageContent>
        {/* Header Section */}
        <div className="bg-gradient-to-b from-blue-50/45 to-white border-b border-gray-200">
          <div className="container mx-auto px-5 sm:px-8 pt-6 sm:pt-8 pb-0">
            {/* Top Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
              {/* Metadata Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <Calendar className="h-4 w-4" />
                  Created: {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <Users className="h-4 w-4" />
                  {totalMembers} members
                </Badge>
                {isJudge && (
                  <Badge variant="default" className="bg-purple-600 px-4 py-2 text-sm font-medium">
                    Judge View
                  </Badge>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  aria-pressed={liked}
                  disabled={likeIsLoading}
                  onClick={() => void toggleLike()}
                  className={`rounded-xl px-5 py-2 shadow-sm ${
                    liked
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-black/5 hover:bg-black/10"
                  }`}
                >
                  {likeIsLoading ? (
                    <Loader className="h-5 w-5 mr-1.5" />
                  ) : (
                    <Heart
                      className="h-5 w-5 mr-1.5"
                      fill={liked ? "currentColor" : "none"}
                    />
                  )}
                  {liked ? "Liked" : "Like"}
                  <span className="ml-2 text-sm">{likesCount}</span>
                </Button>
                <Button
                  onClick={() => setShowFeedbackDialog(true)}
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-5 py-2 shadow-sm"
                >
                  Give feedback
                </Button>
              </div>
            </div>

            {/* Project Title and Hero Section */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-20 mb-6 sm:mb-12">
              {/* Left: Title and Description */}
              <div className="flex-1 space-y-4 sm:space-y-8 order-1">
                <div className="space-y-6">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-black tracking-tight leading-8 sm:leading-9">
                    {project.project_name}
                  </h1>

                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    {project.project_description}
                  </p>
                </div>

                {/* Action Buttons for Project */}
                <div className="flex gap-3">
                  {project.project_url && (
                    <a
                      href={project.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 shadow-sm">
                        <ArrowUpRight className="h-5 w-5 mr-1.5" />
                        View Live Project
                      </Button>
                    </a>
                  )}
                  {project.video_url && (
                    <a
                      href={project.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="secondary"
                        className="bg-black/5 hover:bg-black/10 rounded-xl px-6 py-2.5 shadow-sm"
                      >
                        <VideoIcon className="h-5 w-5 mr-1.5" />
                        Watch Video
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Right: Cover Image */}
              <div className="w-full lg:w-[520px] h-[200px] sm:h-[250px] lg:h-[300px] rounded-2xl overflow-hidden shadow-lg order-2">
                <div
                  className="w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url(${
                      project.cover_image_url || "/img/placeholder.png"
                    })`,
                  }}
                ></div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-transparent border-b border-gray-200 rounded-none h-auto p-0 w-full justify-start gap-3 sm:gap-6 overflow-x-auto scrollbar-hide flex-nowrap">
                <TabsTrigger
                  value="overview"
                  className="shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 font-medium"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="team"
                  className="shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 flex items-center gap-2"
                >
                  Team
                  <Badge variant="secondary" className="bg-white border border-black/15 text-black rounded-full text-xs">
                    {totalMembers}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="feedback"
                  className="shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2"
                >
                  Feedback
                </TabsTrigger>
                {isJudge && (
                  <TabsTrigger
                    value="scoring"
                    className="shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2"
                  >
                    Judge Scoring
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="sharing"
                  className="shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2"
                >
                  Sharing
                </TabsTrigger>
              </TabsList>

              {/* Main Content Area */}
              <div className="py-6 sm:py-12">
                <div className="flex flex-col lg:flex-row gap-6 sm:gap-10">
                  {/* Left Column: Main Content */}
                  <div className="flex-1 space-y-12">
                    <TabsContent value="overview" className="mt-0">
                      <div className="space-y-8">
                        {/* About this project */}
                        <div>
                          <h2 className="text-3xl font-semibold text-black mb-6 tracking-tight">
                            About this project
                          </h2>
                          <p className="text-base text-black leading-relaxed">
                            {project.project_description}
                          </p>
                        </div>

                        {/* Cover Image Display */}
                        {project.cover_image_url && (
                          <div className="space-y-2">
                            <div className="rounded-xl overflow-hidden">
                              <img
                                src={project.cover_image_url}
                                alt="Project cover"
                                className="w-full h-auto object-cover"
                              />
                            </div>
                          </div>
                        )}

                        {/* Video Embed */}
                        {project.video_url && canEmbed(project.video_url) && (
                          <div className="space-y-4">
                            <VideoEmbed url={project.video_url} title="Project Video" />
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="team" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Team Members</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 border rounded">
                              <div>
                                <p className="font-medium">{project.lead_name}</p>
                                <p className="text-sm text-gray-500">
                                  {project.lead_email}
                                </p>
                              </div>
                              <Badge>Lead</Badge>
                            </div>

                            {project.teammates?.map((teammate, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 border rounded"
                              >
                                <div>
                                  <p className="font-medium">{teammate}</p>
                                  <p className="text-sm text-gray-500">Team Member</p>
                                </div>
                                <Badge variant="secondary">Member</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="feedback" className="mt-0">
                      <div className="space-y-8">
                        {/* Display Existing Feedback */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <MessageSquare className="h-5 w-5" />
                              Project Feedback
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                              See what mentors and peers have said about this project.
                            </p>
                          </CardHeader>
                          <CardContent>
                            <FeedbackDisplay projectId={project.id} showTitle={false} />
                          </CardContent>
                        </Card>

                        {/* Submit Feedback Section */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <MessageSquare className="h-5 w-5" />
                              Share Your Feedback
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                              Help this project improve by sharing your thoughts, suggestions,
                              and ideas.
                            </p>
                          </CardHeader>
                          <CardContent>
                            <FeedbackForm
                              projectId={project.id}
                              projectName={project.project_name}
                              projectDescription={project.project_description}
                              projectLeadEmail={project.lead_email}
                              projectLeadName={project.lead_name}
                              project_url={project.project_url}
                              additional_materials_url={project.additional_materials_url}
                              eventId={project.event_id}
                              noBorder={true}
                              showMetadata={false}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* Judge Scoring Tab */}
                    {isJudge && (
                      <TabsContent value="scoring" className="mt-0">
                        <Card className="border-purple-200 bg-purple-50">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-purple-900">
                              <Scale className="h-5 w-5" />
                              Judge Scoring (Private)
                            </CardTitle>
                            <p className="text-sm text-purple-700">
                              This section is only visible to judges and administrators. Use
                              this form to score the project based on the track criteria.
                              Your feedback as a judge will not be visible to the public.
                            </p>
                          </CardHeader>
                          <CardContent className="bg-white rounded-lg border border-purple-200">
                            {projectTracks.length === 0 ? (
                              <div className="text-center py-8">
                                <p className="text-gray-600 mb-2">
                                  This project is not assigned to any tracks yet.
                                </p>
                                <p className="text-sm text-gray-500">
                                  Contact the event organizer to assign this project to a
                                  track before scoring.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {/* Track Selection */}
                                {projectTracks.length > 1 && (
                                  <div className="space-y-2 mt-4">
                                    <label className="text-sm font-medium text-gray-700">
                                      Select Track to Score:
                                    </label>
                                    <select
                                      value={selectedTrackId}
                                      onChange={(e) => setSelectedTrackId(e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                                    >
                                      {projectTracks.map((track) => (
                                        <option key={track.track_id} value={track.track_id}>
                                          {track.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Track Info */}
                                {selectedTrack && (
                                  <div className="p-4 bg-blue-50 rounded-lg mt-4">
                                    <h4 className="font-medium text-gray-900 mb-1">
                                      {selectedTrack.name}
                                    </h4>
                                    {selectedTrack.description && (
                                      <p className="text-sm text-gray-600">
                                        {selectedTrack.description}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Scoring Form */}
                                {selectedTrack && selectedTrack.scoring_criteria ? (
                                  <ProjectScoringForm
                                    projectId={project.id}
                                    trackId={selectedTrackId}
                                    criteria={
                                      (selectedTrack.scoring_criteria as TrackScoringConfig)
                                        .criteria
                                    }
                                    onScoreSubmitted={handleScoreSubmitted}
                                  />
                                ) : (
                                  <div className="text-center py-8">
                                    <p className="text-yellow-600 mb-2">
                                      Scoring criteria not configured for this track.
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Contact the event organizer to set up scoring
                                      criteria.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    )}

                    {/* Sharing Tab */}
                    <TabsContent value="sharing" className="mt-0">
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr,500px] gap-6">
                        {/* Left Column: Share Card */}
                        <Card className="border border-zinc-200">
                          <CardHeader>
                            <CardTitle className="text-[22px] font-semibold tracking-[-0.06em]">
                              Share & Get Feedback
                            </CardTitle>
                            <p className="text-sm text-zinc-500">
                              Share this project with others using the QR code or direct link.
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Copy Link Section */}
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  value={feedbackUrl}
                                  readOnly
                                  className="flex-1 bg-white"
                                />
                                <Button
                                  variant="secondary"
                                  className="bg-zinc-100 hover:bg-zinc-200"
                                  onClick={() => {
                                    navigator.clipboard.writeText(feedbackUrl);
                                    toast({
                                      title: "Copied!",
                                      description: "Link copied to clipboard",
                                    });
                                  }}
                                >
                                  Copy Link
                                </Button>
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-zinc-200" />

                            {/* QR Code Section */}
                            <div className="space-y-4">
                              <div className="w-[206px] h-[201px] bg-white">
                                <QRCodeSVG
                                  id="project-qr-code"
                                  value={feedbackUrl}
                                  size={200}
                                  level="H"
                                />
                              </div>

                              <p className="text-sm text-black">
                                Scan this QR code to share and provide feedback
                              </p>

                              <div className="flex gap-3">
                                <Button
                                  variant="outline"
                                  className="border-[1.5px] border-[rgba(0,0,0,0.05)]"
                                  onClick={handleCopyQR}
                                >
                                  <Copy className="h-5 w-5 mr-2" />
                                  Copy
                                </Button>
                                <Button
                                  variant="outline"
                                  className="border-[1.5px] border-[rgba(0,0,0,0.05)]"
                                  onClick={handleDownloadQR}
                                >
                                  <Download className="h-5 w-5 mr-2" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Right Column: Sharing Tips */}
                        <div className="bg-gradient-to-b from-blue-100/45 to-blue-50/30 rounded-lg p-6 space-y-6">
                          <div className="bg-white rounded-[13px] p-1.5 w-fit">
                            <Lightbulb className="h-6 w-6" />
                          </div>

                          <div className="text-center">
                            <p className="font-medium text-base text-black">Sharing Tips</p>
                          </div>

                          <div className="space-y-3">
                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-['Poly'] text-zinc-900">01</p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Save the QR code image to share digitally
                              </p>
                            </div>

                            <div className="border-t border-gray-200" />

                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-['Poly'] text-zinc-900">02</p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Print it on business cards or project handouts
                              </p>
                            </div>

                            <div className="border-t border-gray-200" />

                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-['Poly'] text-zinc-900">03</p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Display it at your project booth or presentation
                              </p>
                            </div>

                            <div className="border-t border-gray-200" />

                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-['Poly'] text-zinc-900">04</p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Add it to your LinkedIn or GitHub profile
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </div>

                  {/* Right Column: Sidebar */}
                  {activeTab !== "sharing" && (
                  <div className="w-full lg:w-[420px] space-y-6">
                    {/* Meet the team */}
                    {activeTab === "overview" && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-black tracking-tight">
                        Meet the team
                      </h3>
                      <div className="space-y-6">
                        {/* Project Lead */}
                        <div className="flex gap-4 items-center">
                          <div className="w-14 h-14 rounded-full bg-gray-300 flex-shrink-0"></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-base text-black">
                                {project.lead_name}
                              </p>
                              <Badge
                                variant="secondary"
                                className="bg-transparent border border-black/15 text-black rounded-full text-sm px-2.5 py-0.5"
                              >
                                Lead
                              </Badge>
                            </div>
                            <p className="text-base text-black">
                              {project.lead_email}
                            </p>
                          </div>
                        </div>

                        {/* Team Members */}
                        {project.teammates?.slice(0, 1).map((teammate, index) => (
                          <div key={index} className="flex gap-4 items-center">
                            <div className="w-14 h-14 rounded-full bg-gray-300 flex-shrink-0"></div>
                            <div className="space-y-0">
                              <p className="font-semibold text-base text-black">
                                {teammate}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Divider */}
                    {activeTab === "overview" && (
                    <div className="border-t border-gray-200"></div>
                    )}

                    {/* Submitted to Event */}
                    {activeTab === "overview" && eventDetails && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-black tracking-tight">
                          Submitted to
                        </h3>
                        <Card className="border border-black/15 rounded-xl overflow-hidden">
                          <div className="relative">
                            {eventDetails.cover_image_url ? (
                              <img
                                src={eventDetails.cover_image_url}
                                alt={eventDetails.event_name}
                                className="w-full h-[180px] object-cover"
                              />
                            ) : (
                              <div className="w-full h-[180px] bg-gradient-to-br from-orange-400 via-blue-500 to-purple-600"></div>
                            )}
                            {eventDetails.start_date && (
                              <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-xl py-3 px-1 text-center w-28">
                                <p className="text-sm text-black">
                                  {new Date(eventDetails.start_date).toLocaleDateString("en-US", { weekday: "short" })}
                                </p>
                                <p className="text-4xl font-semibold text-black tracking-tight leading-none">
                                  {new Date(eventDetails.start_date).getDate()}
                                </p>
                                <p className="text-sm text-black">
                                  {new Date(eventDetails.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                </p>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                              <h4 className="text-2xl font-semibold text-black tracking-tight">
                                {eventDetails.event_name}
                              </h4>
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-4 w-4 text-black" />
                                <span className="text-black text-center">
                                  {eventDetails.location || "Online"}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Divider */}
                    {activeTab === "overview" && (
                    <div className="border-t border-gray-200"></div>
                    )}

                    {/* Additional materials */}
                    {activeTab === "overview" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-black tracking-tight">
                        Additional materials
                      </h3>
                      {project.additional_materials_url ? (
                        <a
                          href={project.additional_materials_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="secondary"
                            className="w-full bg-black/5 hover:bg-black/10 rounded-xl py-2.5 shadow-sm justify-center"
                          >
                            <ArrowUpRight className="h-5 w-5 mr-1.5" />
                            View Materials
                          </Button>
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No additional materials available
                        </p>
                      )}
                    </div>
                    )}

                    {/* Divider */}
                    {activeTab === "overview" && (
                    <div className="border-t border-gray-200"></div>
                    )}

                    {/* Share this project */}
                    {activeTab === "overview" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-black tracking-tight">
                        Share this project
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="bg-white rounded-full"
                          onClick={() => {
                            navigator.clipboard.writeText(feedbackUrl);
                            toast({
                              title: "Link copied!",
                              description: "Project link copied to clipboard",
                            });
                          }}
                        >
                          <LinkIcon className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="bg-white rounded-full"
                        >
                          <Share2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Give Feedback Dialog */}
        {project && (
          <GiveFeedbackDialog
            open={showFeedbackDialog}
            onOpenChange={setShowFeedbackDialog}
            projectName={project.project_name}
            projectId={project.id}
            projectDescription={project.project_description || ""}
            eventId={project.event_id || ""}
          />
        )}
      </PageContent>
    </PageContainer>
  );
}
