"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft,
  Video as VideoIcon,
  Download,
  Copy,
  QrCode,
  Link as LinkIcon,
  Scale,
  MessageSquare,
  Lightbulb,
} from "lucide-react";
import FeedbackDisplay from "@/features/projects/components/feedback/FeedbackDisplay";
import { GiveFeedbackDialog } from "@/features/projects/components/feedback/GiveFeedbackDialog";
import { useQRCodeActions } from "@/features/projects/components/management/project-dashboard/hooks/useQRCodeActions";
import { useProjectLike } from "@/features/projects/hooks/use-project-like";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { DefaultScoring } from "@/components/project-scoring/default-scoring";
import { EventRole, EventTrack, EventVisibility, Project } from "@/lib/types";
import { VideoEmbed, canEmbed } from "@/components/utils";
import { canAccessRole } from "@/features/user/roles/roles";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { ProjectDescription } from "@/components/projects/ProjectDescription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils/string";
import { ProjectSubmissionDetails } from "@/features/projects/components/displays/ProjectSubmissionDetails";
import { ProjectFieldEntriesSection } from "@/features/projects/components/displays/ProjectFieldEntriesSection";
import {
  CoverImageWithFallback,
  ProjectCoverHero,
} from "@/features/projects/components/displays/cover-image-with-fallback";

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
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchComplete, setFetchComplete] = useState(false);
  const [isJudge, setIsJudge] = useState(false);
  const [judgeId, setJudgeId] = useState("");
  const [isCheckingJudgeStatus, setIsCheckingJudgeStatus] = useState(false);
  const [projectTracks, setProjectTracks] = useState<EventTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [viewAllTracks, setViewAllTracks] = useState<boolean>(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [finalistFeatureEnabled, setFinalistFeatureEnabled] =
    useState<boolean>(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [teamProfileByEmail, setTeamProfileByEmail] = useState<
    Record<
      string,
      {
        displayName: string | null;
        avatarUrl: string | null;
        affiliation: string | null;
      }
    >
  >({});

  // QR Code functionality
  const { handleCopyQR, handleDownloadQR } = useQRCodeActions(
    project?.event_id || "",
    projectId,
    project?.project_name,
  );

  const {
    liked,
    count: likesCount,
    isLoading: likeIsLoading,
    toggleLike,
  } = useProjectLike(projectId);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      setFetchComplete(false);

      const response = await fetch(`/api/projects?projectId=${projectId}`);
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        project?: Project;
      };

      if (!response.ok || !payload.project) {
        setProject(null);
      } else {
        // Do not need to check event visibility here; "public" does not mean public to the world, it means public to the event
        // Event access check is controlled via RLS; if the event is public, the project is public

        setProject(payload.project);
      }

      setIsLoading(false);
      setFetchComplete(true);
    };

    fetchProject();
  }, [projectId]);

  // Fetch team profile data (display name, avatar, affiliation) from user_profiles
  useEffect(() => {
    if (!project) return;
    if (!project.lead_email && !(project.teammates?.length ?? 0)) return;

    const emails = Array.from(
      new Set([project.lead_email, ...(project.teammates ?? [])])
    )
      .filter(Boolean)
      .map((e) => String(e).toLowerCase());

    if (emails.length === 0) return;

    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("email, affiliation, avatar_url, display_name")
          .in("email", emails);

        if (error || !alive) return;

        const map: Record<
          string,
          {
            displayName: string | null;
            avatarUrl: string | null;
            affiliation: string | null;
          }
        > = {};

        for (const row of data ?? []) {
          const email = row.email?.toLowerCase();
          if (!email) continue;
          map[email] = {
            displayName: row.display_name?.trim() || null,
            avatarUrl: row.avatar_url?.trim() || null,
            affiliation: row.affiliation?.trim() || null,
          };
        }

        setTeamProfileByEmail(map);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [project?.lead_email, project?.teammates, project]);

  // Fetch event details when project is loaded
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!project?.event_id) return;

      try {
        const { data: eventData, error } = await supabase
          .from("events")
          .select(
            "event_id, event_name, slug, event_date, location, cover_image_url, finalist_recommendation_enabled",
          )
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
          setFinalistFeatureEnabled(
            !!eventData.finalist_recommendation_enabled,
          );
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
          setJudgeId("");
          setIsCheckingJudgeStatus(false);
          return;
        }

        setJudgeId(session.user.id);

        const { data: roleData, error } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("event_id", project.event_id)
          .single();

        if (error) {
          setIsJudge(false);
          setJudgeId("");
          setIsCheckingJudgeStatus(false);
          return;
        }

        const judgeStatus = canAccessRole(
          roleData?.role as EventRole,
          EventRole.Judge,
        );
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
              `,
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
                (track) => track.event_tracks,
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
        setJudgeId("");
      } finally {
        setIsCheckingJudgeStatus(false);
      }
    };

    checkJudgeStatus();
  }, [project?.event_id, project?.id]);

  if (isLoading || !fetchComplete) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-10 w-10 animate-spin text-blue-500" />
          </div>
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
  const teamMembers =
    project &&
    [
      {
        email: project.lead_email,
        displayName:
          teamProfileByEmail[project.lead_email.toLowerCase()]?.displayName ||
          project.lead_name,
        role: "lead" as const,
      },
      ...(project.teammates ?? []).map((email) => ({
        email,
        displayName:
          teamProfileByEmail[email.toLowerCase()]?.displayName || email,
        role: "member" as const,
      })),
    ];
  const feedbackUrl = typeof window !== "undefined" ? window.location.href : "";
  const selectedTrack = projectTracks.find(
    (track) => track.track_id === selectedTrackId,
  );
  const handleShare = (platform: string) => {
    switch (platform) {
      case "copy":
        navigator.clipboard.writeText(feedbackUrl);
        alert("Link copied to clipboard!");
        break;
      case "linkedin":
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(feedbackUrl)}`,
          "_blank",
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(feedbackUrl)}`,
          "_blank",
        );
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(feedbackUrl)}`,
          "_blank",
        );
        break;
    }
  };

  const projectArtifacts = project?.artifacts || [];
  const extraProjectLinks = projectArtifacts.filter(
    (artifact) =>
      artifact.kind === "project_link" && artifact.url !== project?.project_url,
  );
  const extraVideoLinks = projectArtifacts.filter(
    (artifact) =>
      artifact.kind === "video_link" && artifact.url !== project?.video_url,
  );
  const extraMaterialLinks = projectArtifacts.filter(
    (artifact) =>
      artifact.kind === "additional_material" &&
      artifact.url !== project?.additional_materials_url,
  );
  const extraActionLinks = [...extraProjectLinks, ...extraVideoLinks];
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    if (eventDetails) {
      router.push(`/events/${eventDetails.event_id}/overview`);
      return;
    }

    router.push("/projects");
  };

  return (
    <PageContainer>
      <Toaster />
      <PageContent>
        {/* Header Section */}
        <div className="bg-gradient-to-b from-blue-50/45 to-white border-b border-gray-200">
          <div className="container mx-auto px-5 sm:px-8 pt-6 sm:pt-8 pb-0">
            {/* Back Button */}
            {eventDetails && (
              <div className="mb-4">
                <Button
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 -ml-3"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to {eventDetails.event_name}
                </Button>
              </div>
            )}

            {/* Top Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
              {/* Metadata Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <Calendar className="h-4 w-4" />
                  Created:{" "}
                  {new Date(project.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <Users className="h-4 w-4" />
                  {totalMembers} members
                </Badge>
                {isJudge && (
                  <Badge
                    variant="default"
                    className="bg-purple-600 px-4 py-2 text-sm font-medium"
                  >
                    Judge View
                  </Badge>
                )}
              </div>

              {/* Action Buttons - Desktop Only */}
              <div className="hidden sm:flex items-center gap-3">
                <Button
                  variant="secondary"
                  aria-pressed={liked}
                  disabled={likeIsLoading}
                  onClick={() => void toggleLike()}
                  className={`rounded-xl px-5 py-2 shadow-sm text-base ${
                    liked
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-black/5 hover:bg-black/10"
                  }`}
                >
                  {likeIsLoading ? (
                    <Loader className="h-6 w-6 mr-1.5" />
                  ) : (
                    <Heart
                      className="h-6 w-6 mr-1.5"
                      fill={liked ? "currentColor" : "none"}
                    />
                  )}
                  {liked ? "Liked" : "Like"}
                  <span className="ml-2 text-sm">{likesCount}</span>
                </Button>
                <Button
                  onClick={() => setShowFeedbackDialog(true)}
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-5 py-2 shadow-sm text-base whitespace-nowrap"
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

                  <ProjectDescription
                    value={project.project_description}
                    variant="header"
                    truncateLines={4}
                    className="text-base sm:text-lg"
                  />
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
                  {extraProjectLinks.map((artifact, index) => (
                    <a
                      key={`${artifact.id || artifact.url}-project-${index}`}
                      href={artifact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="rounded-xl px-6 py-2.5 shadow-sm"
                      >
                        <LinkIcon className="h-5 w-5 mr-1.5" />
                        {artifact.label}
                      </Button>
                    </a>
                  ))}
                  {extraVideoLinks.map((artifact, index) => (
                    <a
                      key={`${artifact.id || artifact.url}-video-${index}`}
                      href={artifact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="rounded-xl px-6 py-2.5 shadow-sm"
                      >
                        <VideoIcon className="h-5 w-5 mr-1.5" />
                        {artifact.label}
                      </Button>
                    </a>
                  ))}
                </div>
              </div>

              {/* Right: Cover Image */}
              <div className="w-full lg:w-[520px] h-[200px] sm:h-[250px] lg:h-[300px] rounded-2xl overflow-hidden shadow-lg order-2">
                <ProjectCoverHero
                  src={project.cover_image_url}
                  alt={`${project.project_name || "Project"} cover`}
                />
              </div>
            </div>

            {/* Action Buttons - Mobile Only */}
            <div className="flex sm:hidden items-center gap-2 mb-6 overflow-x-auto">
              <Button
                variant="secondary"
                aria-pressed={liked}
                disabled={likeIsLoading}
                onClick={() => void toggleLike()}
                className={`rounded-xl px-3 py-2 shadow-sm text-base ${
                  liked
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-black/5 hover:bg-black/10"
                }`}
              >
                {likeIsLoading ? (
                  <Loader className="h-6 w-6" />
                ) : (
                  <Heart
                    className="h-6 w-6"
                    fill={liked ? "currentColor" : "none"}
                  />
                )}
                <span className="ml-2 text-sm">{likesCount}</span>
              </Button>
              <Button
                onClick={() => setShowFeedbackDialog(true)}
                className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-5 py-2 shadow-sm text-base whitespace-nowrap"
              >
                Give feedback
              </Button>
            </div>

            {/* Tabs Navigation */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
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
                  <Badge
                    variant="secondary"
                    className="bg-white border border-black/15 text-black rounded-full text-xs"
                  >
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
                {/* Overview Tab - 2 Column Layout */}
                <TabsContent value="overview" className="mt-0">
                  <div className="flex flex-col lg:flex-row gap-6 sm:gap-10">
                    {/* Left Column: Main Content */}
                    <div className="flex-1 space-y-8">
                      {/* About this project */}
                      <div>
                        <h2 className="text-3xl font-semibold text-black mb-6 tracking-tight">
                          About this project
                        </h2>
                        <ProjectDescription
                          value={project.project_description}
                          className="text-base"
                        />
                      </div>

                      <ProjectSubmissionDetails project={project} />

                      {/* Read-only on the public route; entries are added from
                          the private project page. */}
                      <ProjectFieldEntriesSection projectId={project.id} />

                      {/* Cover Image Display */}
                      {project.cover_image_url && (
                        <div className="space-y-2 rounded-xl border border-black/10 p-3">
                          <div className="rounded-xl overflow-hidden">
                            <CoverImageWithFallback
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
                          <VideoEmbed
                            url={project.video_url}
                            title="Project Video"
                          />
                        </div>
                      )}
                    </div>

                    {/* Right Column: Sidebar - Only for Overview */}
                    <div className="w-full lg:w-[420px] space-y-6">
                      {/* Meet the team */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-bold text-black tracking-tight">
                          Meet the team
                        </h3>
                        <div className="space-y-6">
                          {/* Project Lead */}
                          <div className="flex gap-4 items-center">
                            <Avatar className="h-14 w-14 shrink-0">
                              <AvatarImage
                                src={
                                  teamProfileByEmail[
                                    project.lead_email.toLowerCase()
                                  ]?.avatarUrl ?? undefined
                                }
                                alt={
                                  teamProfileByEmail[
                                    project.lead_email.toLowerCase()
                                  ]?.displayName ||
                                  project.lead_name ||
                                  project.lead_email
                                }
                              />
                              <AvatarFallback>
                                {getInitials(project.lead_name || project.lead_email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-base text-black">
                                  {teamProfileByEmail[
                                    project.lead_email.toLowerCase()
                                  ]?.displayName || project.lead_name}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className="bg-transparent border border-black/15 text-black rounded-full text-sm px-2.5 py-0.5"
                                >
                                  Lead
                                </Badge>
                              </div>
                              {teamProfileByEmail[
                                project.lead_email.toLowerCase()
                              ]?.affiliation ? (
                                <p className="text-base text-black">
                                  {
                                    teamProfileByEmail[
                                      project.lead_email.toLowerCase()
                                    ]?.affiliation
                                  }
                                </p>
                              ) : (
                                <p className="text-base text-black">
                                  {project.lead_email}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Team Members */}
                          {project.teammates
                            ?.slice(0, 1)
                            .map((teammate, index) => (
                              <div
                                key={index}
                                className="flex gap-4 items-center"
                              >
                                <Avatar className="h-14 w-14 shrink-0">
                                  <AvatarImage
                                    src={
                                      teamProfileByEmail[
                                        teammate.toLowerCase()
                                      ]?.avatarUrl ?? undefined
                                    }
                                    alt={
                                      teamProfileByEmail[
                                        teammate.toLowerCase()
                                      ]?.displayName || teammate
                                    }
                                  />
                                  <AvatarFallback>
                                    {getInitials(
                                      teamProfileByEmail[
                                        teammate.toLowerCase()
                                      ]?.displayName || teammate
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="space-y-0">
                                  <p className="font-semibold text-base text-black">
                                    {teamProfileByEmail[teammate.toLowerCase()]
                                      ?.displayName || teammate}
                                  </p>
                                  {teamProfileByEmail[teammate.toLowerCase()]
                                    ?.affiliation ? (
                                    <p className="text-base text-black">
                                      {
                                        teamProfileByEmail[
                                          teammate.toLowerCase()
                                        ]?.affiliation
                                      }
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-200"></div>

                      {/* Submitted to Event */}
                      {eventDetails && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-black tracking-tight">
                            Submitted to
                          </h3>
                          <Link
                            href={`/events/${eventDetails.event_id}/overview`}
                          >
                            <Card className="border border-black/15 rounded-xl overflow-hidden hover:shadow-lg">
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
                                      {new Date(
                                        eventDetails.start_date,
                                      ).toLocaleDateString("en-US", {
                                        weekday: "short",
                                      })}
                                    </p>
                                    <p className="text-4xl font-semibold text-black tracking-tight leading-none">
                                      {new Date(
                                        eventDetails.start_date,
                                      ).getDate()}
                                    </p>
                                    <p className="text-sm text-black">
                                      {new Date(
                                        eventDetails.start_date,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        year: "numeric",
                                      })}
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
                          </Link>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-gray-200"></div>

                      {/* Additional links */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-black tracking-tight">
                          Additional links
                        </h3>
                        <div className="space-y-2">
                          {extraActionLinks.length > 0 ? (
                            extraActionLinks.map((artifact, index) => (
                              <a
                                key={`${artifact.id || artifact.url}-extra-link-${index}`}
                                href={artifact.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Button
                                  variant="secondary"
                                  className="w-full bg-black/5 hover:bg-black/10 rounded-xl py-2.5 shadow-sm justify-center"
                                >
                                  <ArrowUpRight className="h-5 w-5 mr-1.5" />
                                  {artifact.label}
                                </Button>
                              </a>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              No additional links available
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-200"></div>

                      {/* Additional materials */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-black tracking-tight">
                          Additional materials
                        </h3>
                        <div className="space-y-2">
                          {project.additional_materials_url ? (
                            <a
                              href={project.additional_materials_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
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
                          {extraMaterialLinks.map((artifact, index) => (
                            <a
                              key={`${artifact.id || artifact.url}-material-${index}`}
                              href={artifact.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <Button
                                variant="secondary"
                                className="w-full bg-black/5 hover:bg-black/10 rounded-xl py-2.5 shadow-sm justify-center"
                              >
                                <ArrowUpRight className="h-5 w-5 mr-1.5" />
                                {artifact.label}
                              </Button>
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-200"></div>

                      {/* Share this project */}
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
                          {/* QR Code */}
                          <button className="flex flex-col items-center justify-center overflow-hidden p-1 rounded-lg">
                            <QrCode className="w-6 h-6 text-black" />
                          </button>

                          {/* LinkedIn */}
                          <button
                            onClick={() => handleShare("linkedin")}
                            className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
                          >
                            {/* <Linkedin className="w-6 h-6 text-black" /> */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              viewBox="0 0 18 18"
                              fill="none"
                            >
                              <path
                                clipRule="evenodd"
                                d="M1.5 0C0.67157 0 0 0.67157 0 1.5V16.5C0 17.3284 0.67157 18 1.5 18H16.5C17.3284 18 18 17.3284 18 16.5V1.5C18 0.67157 17.3284 0 16.5 0H1.5ZM5.52076 4.00272C5.52639 4.95897 4.81061 5.54819 3.96123 5.54397C3.16107 5.53975 2.46357 4.90272 2.46779 4.00413C2.47201 3.15897 3.13998 2.47975 4.00764 2.49944C4.88795 2.51913 5.52639 3.1646 5.52076 4.00272ZM9.2797 6.76176H6.75971H6.7583V15.3216H9.4217V15.1219C9.4217 14.742 9.4214 14.362 9.4211 13.9819C9.4203 12.9681 9.4194 11.9532 9.4246 10.9397C9.426 10.6936 9.4372 10.4377 9.5005 10.2028C9.7381 9.3253 10.5271 8.7586 11.4074 8.8979C11.9727 8.9864 12.3467 9.3141 12.5042 9.8471C12.6013 10.1803 12.6449 10.5389 12.6491 10.8863C12.6605 11.9339 12.6589 12.9815 12.6573 14.0292C12.6567 14.399 12.6561 14.769 12.6561 15.1388V15.3202H15.328V15.1149C15.328 14.6629 15.3278 14.211 15.3275 13.7591C15.327 12.6296 15.3264 11.5001 15.3294 10.3702C15.3308 9.8597 15.276 9.3563 15.1508 8.8627C14.9638 8.1286 14.5771 7.5211 13.9485 7.0824C13.5027 6.77019 13.0133 6.5691 12.4663 6.5466C12.404 6.54401 12.3412 6.54062 12.2781 6.53721C11.9984 6.52209 11.7141 6.50673 11.4467 6.56066C10.6817 6.71394 10.0096 7.0641 9.5019 7.6814C9.4429 7.7522 9.3852 7.8241 9.2991 7.9314L9.2797 7.9557V6.76176ZM2.68164 15.3244H5.33242V6.76733H2.68164V15.3244Z"
                                fill="black"
                              />
                            </svg>
                          </button>

                          {/* Twitter/X */}
                          <button
                            onClick={() => handleShare("twitter")}
                            className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
                          >
                            <svg
                              className="w-6 h-6"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </button>

                          {/* Facebook */}
                          <button
                            onClick={() => handleShare("facebook")}
                            className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
                          >
                            {/* <Facebook className="w-6 h-6 text-black" /> */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <path
                                d="M22 12.3033C22 6.7467 17.5229 2.24219 12 2.24219C6.47715 2.24219 2 6.7467 2 12.3033C2 17.325 5.65684 21.4874 10.4375 22.2422V15.2116H7.89844V12.3033H10.4375V10.0867C10.4375 7.56515 11.9305 6.17231 14.2146 6.17231C15.3088 6.17231 16.4531 6.36882 16.4531 6.36882V8.8448H15.1922C13.95 8.8448 13.5625 9.62041 13.5625 10.4161V12.3033H16.3359L15.8926 15.2116H13.5625V22.2422C18.3432 21.4874 22 17.3252 22 12.3033Z"
                                fill="black"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Team Tab - Single Column */}
                <TabsContent value="team" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>Team Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {teamMembers?.map((member) => {
                          const emailKey = member.email.toLowerCase();
                          const profile = teamProfileByEmail[emailKey];
                          const title =
                            member.displayName?.trim() || member.email;
                          const subtitle =
                            profile?.affiliation?.trim() ||
                            (title.toLowerCase() === member.email.toLowerCase()
                              ? member.email
                              : null);

                          return (
                            <div
                              key={member.email}
                              className="flex items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <Avatar className="h-14 w-14 shrink-0">
                                  <AvatarImage
                                    src={profile?.avatarUrl ?? undefined}
                                    alt={title}
                                  />
                                  <AvatarFallback>
                                    {getInitials(title)}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <p className="font-semibold text-base text-black truncate">
                                      {title}
                                    </p>
                                    {member.role === "lead" ? (
                                      <Badge
                                        variant="secondary"
                                        className="bg-transparent border border-black/15 text-black rounded-full text-sm px-2.5 py-0.5"
                                      >
                                        Lead
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {subtitle ? (
                                    <p className="text-base text-black truncate">
                                      {subtitle}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              {/* Placeholder for future actions like Follow button */}
                              <div className="shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Feedback Tab - Single Column */}
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
                          See what mentors and peers have said about this
                          project.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <FeedbackDisplay
                          projectId={project.id}
                          showTitle={false}
                        />
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
                          Help this project improve by sharing your thoughts,
                          suggestions, and ideas.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => setShowFeedbackDialog(true)}
                          className="w-full bg-[#4B89EF] hover:bg-[#3F77D3] text-white"
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Give Feedback
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Judge Scoring Tab - Single Column */}
                {isJudge && (
                  <TabsContent value="scoring" className="mt-0">
                    <Card className="border-purple-200 bg-purple-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-900">
                          <Scale className="h-5 w-5" />
                          Judge Scoring (Private)
                        </CardTitle>
                        <p className="text-sm text-purple-700">
                          This section is only visible to judges and
                          administrators. Use this form to score the project
                          based on the track criteria. Your feedback as a judge
                          will not be visible to the public.
                        </p>
                      </CardHeader>
                      <CardContent className="bg-white rounded-lg border border-purple-200">
                        {projectTracks.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-600 mb-2">
                              This project is not assigned to any tracks yet.
                            </p>
                            <p className="text-sm text-gray-500">
                              Contact the event organizer to assign this project
                              to a track before scoring.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Track Selection and View All Toggle */}
                            {projectTracks.length > 1 && (
                              <div className="space-y-4 mt-4">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-gray-700">
                                    Select Track to Score:
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={viewAllTracks}
                                      onChange={(e) =>
                                        setViewAllTracks(e.target.checked)
                                      }
                                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                      View All Tracks
                                    </span>
                                  </label>
                                </div>
                                {!viewAllTracks && (
                                  <select
                                    value={selectedTrackId}
                                    onChange={(e) =>
                                      setSelectedTrackId(e.target.value)
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                                  >
                                    {projectTracks.map((track) => (
                                      <option
                                        key={track.track_id}
                                        value={track.track_id}
                                      >
                                        {track.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}

                            {/* Single Track View */}
                            {!viewAllTracks && selectedTrack && (
                              <>
                                {/* Track Info */}
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

                                {/* Scoring Form */}
                                {selectedTrack.scoring_criteria ? (
                                  <DefaultScoring
                                    projectId={project.id}
                                    eventId={project.event_id}
                                    judgeId={judgeId}
                                    trackId={selectedTrackId}
                                    finalistFeatureEnabled={
                                      finalistFeatureEnabled
                                    }
                                    hideProjectHeader
                                  />
                                ) : (
                                  <div className="text-center py-8">
                                    <p className="text-yellow-600 mb-2">
                                      Scoring criteria not configured for this
                                      track.
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Contact the event organizer to set up
                                      scoring criteria.
                                    </p>
                                  </div>
                                )}
                              </>
                            )}

                            {/* All Tracks View */}
                            {viewAllTracks && (
                              <div className="space-y-6 mt-4">
                                {projectTracks.map((track) => (
                                  <div
                                    key={track.track_id}
                                    className="border border-purple-200 rounded-lg p-6 bg-white"
                                  >
                                    {/* Track Header */}
                                    <div className="p-4 bg-blue-50 rounded-lg mb-4">
                                      <h4 className="font-medium text-gray-900 mb-1">
                                        {track.name}
                                      </h4>
                                      {track.description && (
                                        <p className="text-sm text-gray-600">
                                          {track.description}
                                        </p>
                                      )}
                                    </div>

                                    {/* Scoring Form */}
                                    {track.scoring_criteria ? (
                                      <DefaultScoring
                                        projectId={project.id}
                                        eventId={project.event_id}
                                        judgeId={judgeId}
                                        trackId={track.track_id}
                                        finalistFeatureEnabled={
                                          finalistFeatureEnabled
                                        }
                                        hideProjectHeader
                                      />
                                    ) : (
                                      <div className="text-center py-8">
                                        <p className="text-yellow-600 mb-2">
                                          Scoring criteria not configured for
                                          this track.
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          Contact the event organizer to set up
                                          scoring criteria.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}

                {/* Sharing Tab - Single Column with custom layout */}
                <TabsContent value="sharing" className="mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr,500px] gap-6">
                    {/* Left Column: Share Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-[22px] font-semibold tracking-[-0.06em]">
                          Share & Get Feedback
                        </CardTitle>
                        <p className="text-sm text-zinc-500">
                          Share this project with others using the QR code or
                          direct link.
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
                        <p className="font-medium text-base text-black">
                          Sharing Tips
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="py-3 space-y-1">
                          <p className="text-[24px] font-sans text-zinc-900">
                            01
                          </p>
                          <p className="text-sm text-zinc-500 leading-[22px]">
                            Save the QR code image to share digitally
                          </p>
                        </div>

                        <div className="border-t border-gray-200" />

                        <div className="py-3 space-y-1">
                          <p className="text-[24px] font-sans text-zinc-900">
                            02
                          </p>
                          <p className="text-sm text-zinc-500 leading-[22px]">
                            Print it on business cards or project handouts
                          </p>
                        </div>

                        <div className="border-t border-gray-200" />

                        <div className="py-3 space-y-1">
                          <p className="text-[24px] font-sans text-zinc-900">
                            03
                          </p>
                          <p className="text-sm text-zinc-500 leading-[22px]">
                            Display it at your project booth or presentation
                          </p>
                        </div>

                        <div className="border-t border-gray-200" />

                        <div className="py-3 space-y-1">
                          <p className="text-[24px] font-sans text-zinc-900">
                            04
                          </p>
                          <p className="text-sm text-zinc-500 leading-[22px]">
                            Add it to your LinkedIn or GitHub profile
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
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
