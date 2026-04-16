"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventScoringConfig, ScoringCriterion, EventTrack } from "@/lib/types";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { RoundsEditor } from "@/components/events/rounds-editor";
import {
  getActiveRound,
} from "@/lib/judging/rounds";
import { getTrackScoringConfigForRound } from "@/lib/judging/scoring-config";
import {
  buildRawScoreExportFiles,
  buildScoreExportFiles,
  buildTrackScores,
  type DashboardProjectScore,
  type RawScoreExportData,
  type TrackScore,
  type TrackScores,
} from "./export";
import { Vote, Gavel, Bot, Download, Link as LinkIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VotingResultsPanel } from "@/components/voting/voting-results-panel";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type MeetingScoreQueryRow = {
  id: string;
  name: string | null;
  project_id: string | null;
  score: number | null;
  agent_id: string | null;
  user_id: string | null;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string | null;
  transcript_url: string | null;
  recording_url: string | null;
};

type ProjectScoreQueryRow = {
  project_id: string;
  track_id: string;
  scores: unknown;
  comments: string | null;
  round_number?: number | null;
  projects: unknown;
  event_tracks: unknown;
};

type AgentMeetingSort = "score_desc" | "score_asc" | "newest" | "oldest";
type TranscriptFilter = "all" | "with" | "without";

interface AgentMeetingScoreRow {
  meetingId: string;
  meetingName: string;
  score: number;
  createdAt: string | null;
  status: string | null;
  agentId: string;
  agentName: string;
  projectId: string | null;
  projectName: string;
  participantId: string | null;
  participantName: string;
  hasTranscript: boolean;
  hasRecording: boolean;
}

interface ScoresTabProps {
  eventId: string;
  scoringConfig: EventScoringConfig;
  onScoringConfigSaved?: (next: EventScoringConfig | null) => void;
}

type SortDirection = "asc" | "desc" | null;

interface TrackSortState {
  column: string;
  direction: SortDirection;
}

export function ScoresTab({
  eventId,
  scoringConfig,
  onScoringConfigSaved,
}: ScoresTabProps) {
  const activeRound = getActiveRound(scoringConfig);
  const [dashboardScoreData, setDashboardScoreData] = useState<
    DashboardProjectScore[]
  >([]);
  const [trackScores, setTrackScores] = useState<TrackScores>({});
  const [rawScoreData, setRawScoreData] = useState<RawScoreExportData[]>([]);
  const [agentMeetingScores, setAgentMeetingScores] = useState<
    AgentMeetingScoreRow[]
  >([]);
  const [eventTracks, setEventTracks] = useState<EventTrack[]>([]);
  const [loading, setLoading] = useState(true);

  // Link tracks to main track feature
  const [linkTracksEnabled, setLinkTracksEnabled] = useState(false);
  const [mainTrackId, setMainTrackId] = useState<string>("");

  // Sorting state for each track
  const [trackSortStates, setTrackSortStates] = useState<Record<string, TrackSortState>>({});

  // Agent scores filters (organizer view)
  const [agentSearch, setAgentSearch] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [minAgentScore, setMinAgentScore] = useState<string>("");
  const [maxAgentScore, setMaxAgentScore] = useState<string>("");
  const [transcriptFilter, setTranscriptFilter] =
    useState<TranscriptFilter>("all");
  const [agentSort, setAgentSort] = useState<AgentMeetingSort>("score_desc");

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  const handleSort = (trackId: string, column: string) => {
    setTrackSortStates((prev) => {
      const currentSort = prev[trackId];
      let newDirection: SortDirection = "desc";
      
      if (currentSort?.column === column) {
        if (currentSort.direction === "desc") {
          newDirection = "asc";
        } else if (currentSort.direction === "asc") {
          newDirection = null;
        }
      }
      
      return {
        ...prev,
        [trackId]: {
          column,
          direction: newDirection,
        },
      };
    });
  };

  const sortScores = (scores: TrackScore[], trackId: string, numericCriteria: ScoringCriterion[]): TrackScore[] => {
    const sortState = trackSortStates[trackId];
    if (!sortState?.direction) {
      // Default sort by average score descending
      return [...scores].sort((a, b) => b.averageScore - a.averageScore);
    }

    const sorted = [...scores];
    const { column, direction } = sortState;
    const multiplier = direction === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (column) {
        case "project":
          aVal = a.projectName.toLowerCase();
          bVal = b.projectName.toLowerCase();
          return multiplier * aVal.localeCompare(bVal);
        
        case "lead":
          aVal = a.leadName.toLowerCase();
          bVal = b.leadName.toLowerCase();
          return multiplier * aVal.localeCompare(bVal);
        
        case "totalAverage":
          return multiplier * (a.averageScore - b.averageScore);
        
        case "judges":
          return multiplier * (a.numberOfJudges - b.numberOfJudges);
        
        default:
          // Check if it's a criterion column
          const criterion = numericCriteria.find((c) => c.id === column);
          if (criterion) {
            const aScore = a.criterionScores[column]?.average || 0;
            const bScore = b.criterionScores[column]?.average || 0;
            return multiplier * (aScore - bScore);
          }
          return 0;
      }
    });

    return sorted;
  };

  const getSortIcon = (trackId: string, column: string) => {
    const sortState = trackSortStates[trackId];
    if (sortState?.column !== column || !sortState?.direction) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    if (sortState.direction === "asc") {
      return <ArrowUp className="w-3 h-3 ml-1" />;
    }
    return <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const exportRawData = async () => {
    const exportFiles = buildRawScoreExportFiles({
      rawScoreData,
      scoringConfig,
      eventId,
    });

    if (exportFiles.length === 0) {
      alert("No raw round score data available to export.");
      return;
    }

    exportFiles.forEach((file) => {
      const csv = Papa.unparse(file.rows);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const exportScores = async () => {
    const exportFiles = buildScoreExportFiles({
      scoreData: dashboardScoreData,
      scoringConfig,
      eventTracks: eventTracks as Array<{
        track_id: string;
        name: string;
        project_tracks?: Array<{ project_id: string }>;
      }>,
      eventId,
      linkTracksEnabled,
      mainTrackId,
    });

    if (exportFiles.length === 0) {
      alert("No round score data available to export.");
      return;
    }

    exportFiles.forEach((file) => {
      const csv = Papa.unparse(file.rows);

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const calculateTrackScores = useCallback(
    (scoreData: DashboardProjectScore[]) => {
      if (!scoreData.length) {
        setTrackScores({});
        return;
      }
      setTrackScores(buildTrackScores(scoreData, scoringConfig));
    },
    [scoringConfig]
  );


  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch event tracks with their projects
        const { data: trackData, error: trackError } = await supabase
          .from("event_tracks")
          .select(`
            *,
            project_tracks (
              project_id,
              projects (
                id,
                project_name,
                lead_name
              )
            )
          `)
          .eq("event_id", eventId);

        if (trackError) {
          console.error("Error fetching event tracks:", trackError);
          throw trackError;
        }

        setEventTracks(trackData || []);

        // Fetch agent "scores" from meetings (one meeting can have one score, tied to an agent + project)
        // If this fails for any reason, we don't want to break the judge scoring dashboard.
        try {
          const { data: meetingData, error: meetingError } = await supabase
            .from("meetings")
            .select(
              "id, name, project_id, score, agent_id, user_id, created_at, started_at, ended_at, status, transcript_url, recording_url"
            )
            .eq("event_id", eventId)
            .not("agent_id", "is", null)
            .not("score", "is", null);

          if (meetingError) throw meetingError;

          const meetingRows = (meetingData || []) as MeetingScoreQueryRow[];

          // Hydrate related display fields (projects, agents, participants)
          const projectIds = Array.from(
            new Set(
              meetingRows
                .map((m) => (m.project_id ? String(m.project_id) : ""))
                .filter(Boolean)
            )
          );
          const agentIds = Array.from(
            new Set(
              meetingRows
                .map((m) => (m.agent_id ? String(m.agent_id) : ""))
                .filter(Boolean)
            )
          );
          const participantIds = Array.from(
            new Set(
              meetingRows
                .map((m) => (m.user_id ? String(m.user_id) : ""))
                .filter(Boolean)
            )
          );

          const projectsById = new Map<string, { project_name: string | null }>();
          const agentsById = new Map<string, { name: string | null }>();
          const participantsById = new Map<
            string,
            { display_name: string | null; email: string | null }
          >();

          if (projectIds.length > 0) {
            const { data: projects, error: projectsError } = await supabase
              .from("projects")
              .select("id, project_name")
              .eq("event_id", eventId)
              .in("id", projectIds);
            if (projectsError) {
              console.error("Error fetching projects for agent scores:", projectsError);
            } else {
              const projectRows = (projects ?? []) as Array<{
                id: string;
                project_name: string | null;
              }>;
              projectRows.forEach(
                (p: { id: string; project_name: string | null }) => {
                  projectsById.set(String(p.id), {
                    project_name: p.project_name ?? null,
                  });
                }
              );
            }
          }

          if (agentIds.length > 0) {
            const { data: agents, error: agentsError } = await supabase
              .from("agents")
              .select("id, name")
              .in("id", agentIds);
            if (agentsError) {
              console.error("Error fetching agents for agent scores:", agentsError);
            } else {
              const agentRows = (agents ?? []) as Array<{
                id: string;
                name: string | null;
              }>;
              agentRows.forEach((a: { id: string; name: string | null }) => {
                agentsById.set(String(a.id), { name: a.name ?? null });
              });
            }
          }

          if (participantIds.length > 0) {
            const profilesResponse = await fetch(
              `/api/events/${eventId}/profiles`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIds: participantIds }),
              }
            );
            const profilesPayload = await profilesResponse.json();
            if (!profilesResponse.ok) {
              console.error(
                "Error fetching participants for agent scores:",
                profilesPayload.error
              );
            } else {
              const userRows = (profilesPayload.profiles ?? []) as Array<{
                uid: string;
                display_name: string | null;
                email: string | null;
              }>;
              userRows.forEach(
                (u: {
                  uid: string;
                  display_name: string | null;
                  email: string | null;
                }) => {
                  participantsById.set(String(u.uid), {
                    display_name: u.display_name ?? null,
                    email: u.email ?? null,
                  });
                }
              );
            }
          }

          const agentMeetingRows: AgentMeetingScoreRow[] = meetingRows
            .map((m) => {
              const meetingId = String(m.id || "");
              const agentId = String(m.agent_id || "");
              const score =
                typeof m.score === "number" ? m.score : Number(m.score);

              if (!meetingId) return null;
              if (!agentId) return null;
              if (!Number.isFinite(score)) return null;

              const projectId = m.project_id ? String(m.project_id) : null;
              const participantId = m.user_id ? String(m.user_id) : null;

              const projectName = projectId
                ? projectsById.get(projectId)?.project_name ?? ""
                : "";
              const agentName = agentsById.get(agentId)?.name ?? "";

              const participant =
                participantId ? participantsById.get(participantId) : null;
              const participantName =
                participant?.display_name ||
                participant?.email ||
                participantId ||
                "";

              return {
                meetingId,
                meetingName: m.name ?? "",
                score,
                createdAt: m.created_at ?? null,
                status: m.status ?? null,
                agentId,
                agentName,
                projectId,
                projectName,
                participantId,
                participantName,
                hasTranscript: Boolean(m.transcript_url),
                hasRecording: Boolean(m.recording_url),
              };
            })
            .filter((r): r is AgentMeetingScoreRow => Boolean(r));

          // Default ordering: highest score first, then newest first
          agentMeetingRows.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bd - ad;
          });

          setAgentMeetingScores(agentMeetingRows);
        } catch (err) {
          console.error("Error fetching agent scores (meetings):", err);
          setAgentMeetingScores([]);
        }

        // Fetch complete raw scores data with all needed fields
        const { data, error } = await supabase
          .from("project_scores")
          .select(
            `
            project_id,
            track_id,
            scores,
            comments,
            round_number,
            projects:projects!inner (
              project_name,
              lead_name,
              lead_email,
              event_id
            ),
            event_tracks:event_tracks!fk_project_scores_track (
              name,
              track_id
            )
          `
          )
          .eq("projects.event_id", eventId)
          .order("track_id");

        if (error) {
          console.error("Error fetching scores:", error);
          throw error;
        }

        if (!data?.length) {
          setDashboardScoreData([]);
          setTrackScores({});
          setRawScoreData([]);
          return;
        }

        const scoreRows = (data || []) as ProjectScoreQueryRow[];

        // Transform data for display (existing logic)
        const allDisplayData = scoreRows.map((item: ProjectScoreQueryRow) => {
          const projectData = item.projects as unknown as {
            project_name: string;
            lead_name: string;
            lead_email: string;
            event_id: string;
          };
          const trackData = item.event_tracks as unknown as {
            name: string;
            track_id: string;
          } | null;

          return {
            ...item,
            event_id: projectData?.event_id || eventId,
            round_number:
              typeof item.round_number === "number" ? item.round_number : 1,
            projects: {
              project_name: projectData?.project_name || "",
              lead_name: projectData?.lead_name || "",
              event_id: projectData?.event_id || eventId,
            },
            tracks: {
              name: trackData?.name || "",
            },
          };
        }) as DashboardProjectScore[];
        const displayData = allDisplayData.filter(
          (item) => item.round_number === activeRound
        );

        // Store raw data for exports
        const rawData: RawScoreExportData[] = scoreRows.map((item: ProjectScoreQueryRow) => {
          const projects = Array.isArray(item.projects)
            ? item.projects[0]
            : item.projects;
          const eventTracks = Array.isArray(item.event_tracks)
            ? item.event_tracks[0]
            : item.event_tracks;

          return {
            scores: item.scores as Record<string, string | number>,
            comments: item.comments,
            round_number:
              typeof item.round_number === "number" ? item.round_number : 1,
            projects: {
              project_name: projects?.project_name || "",
              lead_email: projects?.lead_email || "",
            },
            event_tracks: {
              name: eventTracks?.name || "",
              track_id: eventTracks?.track_id || "",
            },
          };
        });

        setDashboardScoreData(allDisplayData);
        setRawScoreData(rawData);
        calculateTrackScores(displayData);
      } catch (error) {
        console.error("Error fetching scores:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Subscribe to real-time score updates
    const judgeScoresSubscription = supabase
      .channel(`project_scores_${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_scores",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          // Just reload all the data on any change
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to real-time agent score updates (meetings table)
    const agentScoresSubscription = supabase
      .channel(`meeting_scores_${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetings",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          // Just reload all the data on any change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      judgeScoresSubscription.unsubscribe();
      agentScoresSubscription.unsubscribe();
    };
  }, [eventId, calculateTrackScores, activeRound]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="judge-scores" className="w-full">
        <TabsList className="font-inter grid w-full grid-cols-3 h-auto p-1 gap-0 rounded-xl bg-white border border-[rgba(0,0,0,0.15)] text-muted-foreground">
          <TabsTrigger
            value="judge-scores"
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-black border border-transparent transition-all data-[state=active]:bg-[var(--Color-Pattens-Blue-Lightest,#FBFCFE)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:font-semibold data-[state=active]:shadow-none hover:text-black/80"
          >
            <Gavel className="w-4 h-4" />
            Judge Scores
          </TabsTrigger>
          <TabsTrigger
            value="agent-scores"
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-black border border-transparent transition-all data-[state=active]:bg-[var(--Color-Pattens-Blue-Lightest,#FBFCFE)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:font-semibold data-[state=active]:shadow-none hover:text-black/80"
          >
            <Bot className="w-4 h-4" />
            Agent Scores
          </TabsTrigger>
          <TabsTrigger
            value="peoples-choice"
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-black border border-transparent transition-all data-[state=active]:bg-[var(--Color-Pattens-Blue-Lightest,#FBFCFE)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:font-semibold data-[state=active]:shadow-none hover:text-black/80"
          >
            <Vote className="w-4 h-4" />
            People&apos;s Choice
          </TabsTrigger>
        </TabsList>

        {/* Judge Scores Tab */}
        <TabsContent value="judge-scores" className="mt-6">
          <div className="space-y-6">
            <RoundsEditor
              eventId={eventId}
              scoringConfig={scoringConfig}
              onSaved={(next) => onScoringConfigSaved?.(next)}
            />

            <Card>
              <CardHeader>
                <CardTitle>Judge Scoring Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Live Judge Scores</h3>
                    <div className="flex space-x-2">
                      <Button
                        onClick={exportRawData}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className="flex h-11 items-center rounded-[12px] px-5 py-2"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Raw Data
                      </Button>
                      <Button
                        onClick={exportScores}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className="flex h-11 items-center rounded-[12px] px-5 py-2"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Tables
                      </Button>
                    </div>
                  </div>

                  {/* Link Tracks to Main Track Controls */}
                  {Object.keys(trackScores).length > 1 && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="link-tracks"
                                checked={linkTracksEnabled}
                                onCheckedChange={(checked) => {
                                  setLinkTracksEnabled(checked);
                                  if (!checked) {
                                    setMainTrackId("");
                                  }
                                }}
                              />
                              <Label htmlFor="link-tracks" className="flex items-center gap-2 cursor-pointer">
                                <LinkIcon className="w-4 h-4" />
                                Link all tracks to main track
                              </Label>
                            </div>
                          </div>

                          {linkTracksEnabled && (
                            <div className="space-y-2">
                              <Label htmlFor="main-track">Select Main Track</Label>
                              <Select
                                value={mainTrackId}
                                onValueChange={setMainTrackId}
                              >
                                <SelectTrigger id="main-track">
                                  <SelectValue placeholder="Choose a main track..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.keys(trackScores).map((trackId) => {
                                    const trackName =
                                      eventTracks.find((t) => t.track_id === trackId)?.name ||
                                      Object.values(scoringConfig.tracks).find((t) =>
                                      trackId.includes(t.name)
                                    )?.name ||
                                    trackId;
                                  return (
                                    <SelectItem key={trackId} value={trackId}>
                                      {trackName}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {mainTrackId && (
                              <p className="text-sm text-muted-foreground">
                                Subtracks will display scores from the{" "}
                                <span className="font-medium">
                                  {eventTracks.find((t) => t.track_id === mainTrackId)?.name ||
                                    Object.values(scoringConfig.tracks).find((t) =>
                                      mainTrackId.includes(t.name)
                                    )?.name ||
                                    mainTrackId}
                                </span>{" "}
                                track
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {loading ? (
                  <div className="text-center py-8">Loading scores...</div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      // Determine which tracks to display
                      // Always include tracks with projects, even if they don't have scores yet
                      const tracksWithProjects = eventTracks
                        .filter((track) => {
                          const projectTracks = (track as unknown as { project_tracks?: Array<{ project_id: string }> }).project_tracks;
                          return projectTracks && projectTracks.length > 0;
                        })
                        .map((track) => track.track_id);
                      
                      // Merge scored tracks with tracks that have projects
                      const tracksToDisplay = Array.from(new Set([...Object.keys(trackScores), ...tracksWithProjects]));
                      
                      // If no tracks to display at all, show message
                      if (tracksToDisplay.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-gray-600">No tracks with projects available yet.</p>
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {tracksToDisplay.map((trackId) => {
                            const scores = trackScores[trackId] || [];
                          // Find the corresponding track name
                          const trackName =
                            eventTracks.find((t) => t.track_id === trackId)?.name ||
                            Object.values(scoringConfig.tracks).find((t) =>
                              trackId.includes(t.name)
                            )?.name ||
                            trackId;

                          // Determine if this is a subtrack (not the main track)
                          const isSubtrack = linkTracksEnabled && mainTrackId && trackId !== mainTrackId;

                          // Get the appropriate config - use main track config if linking is enabled
                          const displayTrackId = isSubtrack ? mainTrackId : trackId;
                          const displayConfig = getTrackScoringConfigForRound({
                            scoringConfig,
                            trackId: displayTrackId,
                            roundNumber: activeRound,
                            fallbackTrackName: trackName,
                          });

                          const choiceCriteria =
                            displayConfig?.criteria.filter(
                              (c) => c.type === "multiplechoice"
                            ) || [];

                          const numericCriteria =
                            displayConfig?.criteria.filter(
                              (c) => c.type !== "multiplechoice"
                            ) || [];

                          // For subtracks, map subtrack projects to main track scores
                          let displayScores: TrackScore[];
                          
                          if (isSubtrack && mainTrackId && trackScores[mainTrackId]) {
                            // Get the projects that are in this subtrack
                            const track = eventTracks.find((t) => t.track_id === trackId);
                            const projectTracks = (track as unknown as { project_tracks?: Array<{ project_id: string; projects: { id: string; project_name: string; lead_name: string } }> })?.project_tracks || [];
                            const subtrackProjectIds = new Set(projectTracks.map((pt) => pt.project_id));
                            
                            // Filter main track scores to only include projects in this subtrack
                            displayScores = trackScores[mainTrackId]
                              .filter((mainScore) => subtrackProjectIds.has(mainScore.projectId))
                              .map((mainScore) => mainScore);
                          } else {
                            displayScores = scores;
                          }

                          // Apply sorting
                          const sortedScores = sortScores(displayScores, trackId, numericCriteria);

                          return (
                            <Card key={trackId} className="overflow-hidden">
                              <div className={`p-4 ${isSubtrack ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-medium">
                                    {trackName} Track
                                  </h3>
                                  {isSubtrack && (
                                    <div className="flex items-center gap-1 text-sm opacity-90">
                                      <LinkIcon className="w-3 h-3" />
                                      <span>Linked to main track</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-16 text-center">
                                          Rank
                                        </TableHead>
                                        <TableHead 
                                          className="min-w-[150px] max-w-[200px] cursor-pointer hover:bg-muted/50"
                                          onClick={() => handleSort(trackId, "project")}
                                        >
                                          <div className="flex items-center">
                                            Project
                                            {getSortIcon(trackId, "project")}
                                          </div>
                                        </TableHead>
                                        <TableHead 
                                          className="min-w-[120px] max-w-[150px] cursor-pointer hover:bg-muted/50"
                                          onClick={() => handleSort(trackId, "lead")}
                                        >
                                          <div className="flex items-center">
                                            Lead
                                            {getSortIcon(trackId, "lead")}
                                          </div>
                                        </TableHead>
                                        <TableHead 
                                          className="text-right min-w-[100px] px-4 cursor-pointer hover:bg-muted/50"
                                          onClick={() => handleSort(trackId, "totalAverage")}
                                        >
                                          <div className="flex items-center justify-end">
                                            Total Average
                                            {getSortIcon(trackId, "totalAverage")}
                                          </div>
                                        </TableHead>
                                        {numericCriteria.map((c) => (
                                          <TableHead
                                            key={c.id}
                                            className="text-right min-w-[100px] max-w-[120px] px-4 cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleSort(trackId, c.id)}
                                          >
                                            <div className="break-words flex items-center justify-end">
                                              <span>
                                                {c.name}
                                                {c.weight && c.weight !== 1 && (
                                                  <span className="text-xs text-muted-foreground ml-1">
                                                    (×{c.weight})
                                                  </span>
                                                )}
                                              </span>
                                              {getSortIcon(trackId, c.id)}
                                            </div>
                                          </TableHead>
                                        ))}
                                        {choiceCriteria.map((c) => (
                                          <TableHead
                                            key={c.id}
                                            className="text-right min-w-[120px] max-w-[150px] px-4"
                                          >
                                            <div className="break-words">
                                              {c.name}
                                            </div>
                                          </TableHead>
                                        ))}
                                        <TableHead 
                                          className="text-center w-20 px-4 cursor-pointer hover:bg-muted/50"
                                          onClick={() => handleSort(trackId, "judges")}
                                        >
                                          <div className="flex items-center justify-center">
                                            Judges
                                            {getSortIcon(trackId, "judges")}
                                          </div>
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sortedScores.map((score, index) => (
                                        <TableRow key={score.projectId}>
                                          <TableCell className="font-medium w-16 text-center">
                                            {index + 1}
                                          </TableCell>
                                          <TableCell className="min-w-[150px] max-w-[200px]">
                                            <div className="break-words">
                                              <Link
                                                href={`/projects/public/${score.projectId}`}
                                                className="text-blue-600 hover:text-blue-700 hover:underline"
                                              >
                                                {score.projectName}
                                              </Link>
                                            </div>
                                          </TableCell>
                                          <TableCell className="min-w-[120px] max-w-[150px]">
                                            <div className="break-words">
                                              {score.leadName}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right font-medium min-w-[100px] px-4 tabular-nums">
                                            {score.averageScore.toFixed(2)}
                                          </TableCell>
                                          {numericCriteria.map((c) => {
                                            const criterionScore =
                                              score.criterionScores[c.id];
                                            return (
                                              <TableCell
                                                key={c.id}
                                                className="text-right min-w-[100px] max-w-[120px] px-4 tabular-nums"
                                              >
                                                {criterionScore
                                                  ? criterionScore.average.toFixed(2)
                                                  : "—"}
                                              </TableCell>
                                            );
                                          })}
                                          {choiceCriteria.map((c) => {
                                            const counts =
                                              score.choiceCounts?.[c.id] || {};
                                            return (
                                              <TableCell
                                                key={c.id}
                                                className="text-right min-w-[120px] max-w-[150px] px-4"
                                              >
                                                <div className="break-words text-sm tabular-nums">
                                                  {(c.options || []).map((opt, i) => (
                                                    <span key={opt}>
                                                      {i > 0 && ", "}
                                                      <span className="text-blue-500">
                                                        {opt}
                                                      </span>
                                                      : {counts[opt] || 0}
                                                    </span>
                                                  ))}
                                                </div>
                                              </TableCell>
                                            );
                                          })}
                                          <TableCell className="text-center w-20 px-4 tabular-nums">
                                            {score.numberOfJudges}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </>
                    );
                  })()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        {/* Agent Scores Tab */}
        <TabsContent value="agent-scores" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Scoring Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading scores...</div>
              ) : agentMeetingScores.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">
                    No agent scores available yet.
                  </p>
                </div>
              ) : (
                (() => {
                  const min =
                    minAgentScore.trim() === ""
                      ? null
                      : Number(minAgentScore);
                  const max =
                    maxAgentScore.trim() === ""
                      ? null
                      : Number(maxAgentScore);

                  const agentOptions = Array.from(
                    new Map(
                      agentMeetingScores
                        .filter((r) => r.agentId)
                        .map((r) => [r.agentId, r.agentName] as const)
                    ).entries()
                  )
                    .map(([id, name]) => ({ id, name }))
                    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

                  const projectOptions = Array.from(
                    new Map(
                      agentMeetingScores
                        .filter((r) => r.projectId)
                        .map((r) => [r.projectId as string, r.projectName] as const)
                    ).entries()
                  )
                    .map(([id, name]) => ({ id, name }))
                    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

                  const filtered = agentMeetingScores.filter((r) => {
                    if (selectedAgentId !== "all" && r.agentId !== selectedAgentId) {
                      return false;
                    }
                    if (
                      selectedProjectId !== "all" &&
                      String(r.projectId || "") !== selectedProjectId
                    ) {
                      return false;
                    }
                    if (transcriptFilter === "with" && !r.hasTranscript) return false;
                    if (transcriptFilter === "without" && r.hasTranscript) return false;
                    if (min !== null && Number.isFinite(min) && r.score < min) return false;
                    if (max !== null && Number.isFinite(max) && r.score > max) return false;

                    const q = agentSearch.trim().toLowerCase();
                    if (!q) return true;
                    const haystack = [
                      r.meetingName,
                      r.projectName,
                      r.agentName,
                      r.participantName,
                      r.status || "",
                    ]
                      .join(" ")
                      .toLowerCase();
                    return haystack.includes(q);
                  });

                  const sorted = [...filtered].sort((a, b) => {
                    if (agentSort === "score_desc") {
                      if (b.score !== a.score) return b.score - a.score;
                      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                      return bd - ad;
                    }
                    if (agentSort === "score_asc") {
                      if (a.score !== b.score) return a.score - b.score;
                      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                      return bd - ad;
                    }
                    if (agentSort === "oldest") {
                      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                      return ad - bd;
                    }
                    // newest
                    const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bd - ad;
                  });

                  const clearFilters = () => {
                    setAgentSearch("");
                    setSelectedAgentId("all");
                    setSelectedProjectId("all");
                    setMinAgentScore("");
                    setMaxAgentScore("");
                    setTranscriptFilter("all");
                    setAgentSort("score_desc");
                  };

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="space-y-1">
                              <div className="text-sm font-medium">Search</div>
                              <EventSearchInput
                                value={agentSearch}
                                onChange={(e) => setAgentSearch(e.target.value)}
                                placeholder="Meeting, project, participant, agent…"
                                inputClassName="text-sm sm:text-sm"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="text-sm font-medium">Agent</div>
                              <Select
                                value={selectedAgentId}
                                onValueChange={setSelectedAgentId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="All agents" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All agents</SelectItem>
                                  {agentOptions.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.name || a.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <div className="text-sm font-medium">Project</div>
                              <Select
                                value={selectedProjectId}
                                onValueChange={setSelectedProjectId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="All projects" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All projects</SelectItem>
                                  {projectOptions.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name || p.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <div className="text-sm font-medium">Score min</div>
                              <Input
                                value={minAgentScore}
                                onChange={(e) => setMinAgentScore(e.target.value)}
                                placeholder="e.g. 70"
                                inputMode="numeric"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="text-sm font-medium">Score max</div>
                              <Input
                                value={maxAgentScore}
                                onChange={(e) => setMaxAgentScore(e.target.value)}
                                placeholder="e.g. 100"
                                inputMode="numeric"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="space-y-1">
                              <div className="text-sm font-medium">Transcript</div>
                              <Select
                                value={transcriptFilter}
                                onValueChange={(v) =>
                                  setTranscriptFilter(v as TranscriptFilter)
                                }
                              >
                                <SelectTrigger className="sm:w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All</SelectItem>
                                  <SelectItem value="with">Has transcript</SelectItem>
                                  <SelectItem value="without">
                                    No transcript
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <div className="text-sm font-medium">Sort</div>
                              <Select
                                value={agentSort}
                                onValueChange={(v) =>
                                  setAgentSort(v as AgentMeetingSort)
                                }
                              >
                                <SelectTrigger className="sm:w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="score_desc">
                                    Score (high → low)
                                  </SelectItem>
                                  <SelectItem value="score_asc">
                                    Score (low → high)
                                  </SelectItem>
                                  <SelectItem value="newest">Newest</SelectItem>
                                  <SelectItem value="oldest">Oldest</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <Button
                              variant="outline"
                              onClick={clearFilters}
                              className="sm:mb-[1px]"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          Showing <span className="font-medium">{sorted.length}</span>{" "}
                          meeting{sorted.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16 text-center">Rank</TableHead>
                              <TableHead className="text-right min-w-[110px] px-4">
                                Score
                              </TableHead>
                              <TableHead className="min-w-[220px]">
                                Conversation
                              </TableHead>
                              <TableHead className="min-w-[220px]">
                                Project
                              </TableHead>
                              <TableHead className="min-w-[200px]">
                                Participant
                              </TableHead>
                              <TableHead className="min-w-[160px]">Agent</TableHead>
                              <TableHead className="min-w-[200px]">
                                Created
                              </TableHead>
                              <TableHead className="min-w-[140px]">Status</TableHead>
                              <TableHead className="text-center w-28">
                                Review
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sorted.map((row, index) => (
                              <TableRow key={row.meetingId}>
                                <TableCell className="font-medium w-16 text-center">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="text-right font-medium min-w-[110px] px-4 tabular-nums">
                                  {row.score}
                                </TableCell>
                                <TableCell className="min-w-[220px]">
                                  <div className="break-words">
                                    {row.meetingName || row.meetingId}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {row.hasTranscript ? "Transcript" : "No transcript"}
                                    {row.hasRecording ? " • Recording" : ""}
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-[220px]">
                                  <div className="break-words">
                                    {row.projectId ? (
                                      <Link
                                        href={`/projects/public/${row.projectId}`}
                                        className="text-blue-600 hover:text-blue-700 hover:underline"
                                      >
                                        {row.projectName || row.projectId}
                                      </Link>
                                    ) : (
                                      row.projectName || "—"
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-[200px]">
                                  <div className="break-words">
                                    {row.participantName || "—"}
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-[160px]">
                                  <div className="break-words">
                                    {row.agentName || row.agentId}
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-[200px]">
                                  <div className="tabular-nums">
                                    {formatDateTime(row.createdAt)}
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-[140px]">
                                  <div className="break-words">
                                    {row.status || "—"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center w-28">
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/learn/${row.meetingId}`}>
                                      Review
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* People's Choice Voting Tab */}
        <TabsContent value="peoples-choice" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>People&apos;s Choice Voting</CardTitle>
            </CardHeader>
            <CardContent>
              <VotingResultsPanel eventId={eventId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
