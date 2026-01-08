"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventScoringConfig, ScoringCriterion, EventTrack } from "@/lib/types";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { Vote, Gavel, Bot, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VotingResultsPanel } from "@/components/voting/voting-results-panel";

interface DashboardProjectScore {
  project_id: string;
  track_id: string;
  event_id: string;
  scores: Record<string, number | string>;
  projects: {
    project_name: string;
    lead_name: string;
    event_id: string;
  };
  tracks: {
    name: string;
  };
}

interface TrackScore {
  projectId: string;
  projectName: string;
  leadName: string;
  averageScore: number;
  totalScore: number;
  numberOfJudges: number;
  criterionScores: Record<string, { total: number; average: number }>;
  choiceCounts?: Record<string, Record<string, number>>;
}

interface TrackScores {
  [trackId: string]: TrackScore[];
}

type MeetingScoreQueryRow = {
  project_id: string | null;
  score: number | null;
  agent_id: string | null;
};

type ProjectScoreQueryRow = {
  project_id: string;
  track_id: string;
  scores: unknown;
  comments: string | null;
  projects: unknown;
  event_tracks: unknown;
};

interface AgentProjectScore {
  projectId: string;
  projectName: string;
  leadName: string;
  averageScore: number;
  totalScore: number;
  numberOfSessions: number;
  numberOfAgents: number;
}

interface ScoresTabProps {
  eventId: string;
  scoringConfig: EventScoringConfig;
}

interface RawScoreData {
  scores: Record<string, string | number>;
  comments: string | null;
  projects: {
    project_name: string;
    lead_email: string;
  };
  event_tracks: {
    name: string;
  };
}

export function ScoresTab({ eventId, scoringConfig }: ScoresTabProps) {
  const [trackScores, setTrackScores] = useState<TrackScores>({});
  const [rawScoreData, setRawScoreData] = useState<RawScoreData[]>([]);
  const [agentScores, setAgentScores] = useState<AgentProjectScore[]>([]);
  const [eventTracks, setEventTracks] = useState<EventTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const exportRawData = async () => {
    if (rawScoreData.length === 0) {
      alert("No raw score data available to export.");
      return;
    }

    // Group data by track
    const trackGroups: Record<string, RawScoreData[]> = {};

    rawScoreData.forEach((score) => {
      const trackName = score.event_tracks.name;
      if (!trackGroups[trackName]) {
        trackGroups[trackName] = [];
      }
      trackGroups[trackName].push(score);
    });

    // Export each track separately
    Object.entries(trackGroups).forEach(([trackName, trackData]) => {
      // Find the track config for this track
      const trackConfig = Object.values(scoringConfig.tracks).find(
        (t) => t.name === trackName
      );

      // Flatten the raw data for CSV export
      const csvData = trackData.map((score) => {
        const baseData: Record<string, string | number | null> = {
          "Project Name": score.projects.project_name || "",
          Track: score.event_tracks.name || "",
          Comments: score.comments || "",
          "Lead Email": score.projects.lead_email || "",
        };

        // Add individual criterion scores with proper names
        if (score.scores && trackConfig) {
          Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
            const criterion = trackConfig.criteria.find(
              (c) => c.id === criterionId
            );
            const criterionName = criterion ? criterion.name : criterionId;
            baseData[criterionName] = scoreValue as string | number | null;
          });
        } else if (score.scores) {
          // Fallback if no track config found
          Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
            baseData[`Score_${criterionId}`] = scoreValue as
              | string
              | number
              | null;
          });
        }

        return baseData;
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `raw-scores-${trackName.replace(/[^a-zA-Z0-9]/g, "_")}-${eventId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const exportScores = async () => {
    if (Object.keys(trackScores).length === 0) {
      alert("No scores available to export.");
      return;
    }

    // Export each track separately
    Object.entries(trackScores).forEach(([trackId, scores]) => {
      // Find the corresponding track name
      const trackName =
        eventTracks.find((t) => t.track_id === trackId)?.name ||
        Object.values(scoringConfig.tracks).find((t) =>
          trackId.includes(t.name)
        )?.name ||
        trackId;

      const trackConfig =
        scoringConfig.tracks[trackId] ||
        Object.values(scoringConfig.tracks).find((t) => t.name === trackName);

      if (!trackConfig) return;

      const numericCriteria = trackConfig.criteria.filter(
        (c) => c.type !== "multiplechoice"
      );

      const choiceCriteria = trackConfig.criteria.filter(
        (c) => c.type === "multiplechoice"
      );

      // Build CSV data matching the table structure
      const csvData = scores.map((score, index) => {
        const row: Record<string, string | number> = {
          Rank: index + 1,
          Project: score.projectName,
          Lead: score.leadName,
          "Total Average": score.averageScore.toFixed(2),
        };

        // Add individual criterion scores
        numericCriteria.forEach((criterion) => {
          const criterionScore = score.criterionScores[criterion.id];
          const columnName =
            criterion.weight && criterion.weight !== 1
              ? `${criterion.name} (×${criterion.weight})`
              : criterion.name;
          row[columnName] = criterionScore
            ? criterionScore.average.toFixed(2)
            : "—";
        });

        // Add choice criteria counts
        choiceCriteria.forEach((criterion) => {
          const counts = score.choiceCounts?.[criterion.id] || {};
          const choiceData = (criterion.options || [])
            .map((opt) => `${opt}: ${counts[opt] || 0}`)
            .join(", ");
          row[criterion.name] = choiceData || "—";
        });

        row["Judges"] = score.numberOfJudges;

        return row;
      });

      // Generate CSV
      const csv = Papa.unparse(csvData);

      // Create and download file
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scores-${trackName.replace(/[^a-zA-Z0-9]/g, "_")}-${eventId}.csv`;
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

      const trackScoresMap: TrackScores = {};

      // Group scores by track and project
      scoreData.forEach((score) => {
        if (!trackScoresMap[score.track_id]) {
          trackScoresMap[score.track_id] = [];
        }

        // Find existing project in track or create new entry
        let projectScore = trackScoresMap[score.track_id].find(
          (p) => p.projectId === score.project_id
        );

        if (!projectScore) {
          projectScore = {
            projectId: score.project_id,
            projectName: score.projects.project_name,
            leadName: score.projects.lead_name,
            averageScore: 0,
            totalScore: 0,
            numberOfJudges: 0,
            criterionScores: {},
          };
          trackScoresMap[score.track_id].push(projectScore);
        }

        // Find track config either by track_id or by matching name
        const trackConfig =
          scoringConfig.tracks[score.track_id] ||
          Object.values(scoringConfig.tracks).find(
            (t) => t.name === score.tracks?.name
          );

        if (!score.scores || Object.keys(score.scores).length === 0) {
          return;
        }

        // Calculate total score and individual criterion scores
        // If we have scoring config, use weighted calculation
        let totalScore = 0;
        Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
          const criterion = trackConfig.criteria.find(
            (c: ScoringCriterion) => c.id === criterionId
          );
          if (!criterion) return;

          if (criterion.type === "multiplechoice") {
            const val = String(scoreValue);
            if (!projectScore.choiceCounts) projectScore.choiceCounts = {};
            if (!projectScore.choiceCounts[criterionId]) {
              projectScore.choiceCounts[criterionId] = {};
            }
            const counts = projectScore.choiceCounts[criterionId];
            counts[val] = (counts[val] || 0) + 1;
          } else {
            const numeric =
              typeof scoreValue === "number"
                ? scoreValue
                : parseFloat(String(scoreValue));
            if (!isNaN(numeric)) {
              const weightedScore = numeric * (criterion.weight || 1);
              totalScore += weightedScore;

              // Track individual criterion scores
              if (!projectScore.criterionScores[criterionId]) {
                projectScore.criterionScores[criterionId] = {
                  total: 0,
                  average: 0,
                };
              }
              projectScore.criterionScores[criterionId].total += numeric;
            }
          }
        });
        projectScore.totalScore += totalScore;
        projectScore.numberOfJudges += 1;
        projectScore.averageScore =
          projectScore.totalScore / projectScore.numberOfJudges;

        // Calculate individual criterion averages
        Object.keys(projectScore.criterionScores).forEach((criterionId) => {
          projectScore.criterionScores[criterionId].average =
            projectScore.criterionScores[criterionId].total /
            projectScore.numberOfJudges;
        });
      });

      // Sort projects by average score within each track
      Object.keys(trackScoresMap).forEach((trackId) => {
        trackScoresMap[trackId].sort((a, b) => b.averageScore - a.averageScore);
      });

      setTrackScores(trackScoresMap);
    },
    [scoringConfig]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch event tracks first
        const { data: trackData, error: trackError } = await supabase
          .from("event_tracks")
          .select("*")
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
            .select("project_id, score, agent_id")
            .eq("event_id", eventId)
            .not("project_id", "is", null)
            .not("agent_id", "is", null)
            .not("score", "is", null);

          if (meetingError) throw meetingError;

          const meetingRows = (meetingData || []) as MeetingScoreQueryRow[];

          // Fetch project details for agent-scored projects (meetings does not guarantee FK joins)
          const agentProjectIds = Array.from(
            new Set(
              meetingRows
                .map((m) => (m.project_id ? String(m.project_id) : ""))
                .filter(Boolean)
            )
          );

          const agentProjectsById = new Map<
            string,
            { project_name: string | null; lead_name: string | null }
          >();

          if (agentProjectIds.length > 0) {
            const { data: agentProjects, error: agentProjectsError } =
              await supabase
                .from("projects")
                .select("id, project_name, lead_name")
                .eq("event_id", eventId)
                .in("id", agentProjectIds);

            if (agentProjectsError) throw agentProjectsError;

            (agentProjects || []).forEach((p) => {
              agentProjectsById.set(String(p.id), {
                project_name: p.project_name ?? null,
                lead_name: p.lead_name ?? null,
              });
            });
          }

          // Aggregate agent scores per project (average across all agents/sessions for that project)
          const agentScoreMap = new Map<
            string,
            {
              projectName: string;
              leadName: string;
              total: number;
              count: number;
              agentIds: Set<string>;
            }
          >();

          meetingRows.forEach((m: MeetingScoreQueryRow) => {
            const projectId = String(m.project_id || "");
            if (!projectId) return;

            const numericScore =
              typeof m.score === "number" ? m.score : Number(m.score);
            if (!Number.isFinite(numericScore)) return;

            const agentId = String(m.agent_id || "");

            const project = agentProjectsById.get(projectId);
            const projectName = project?.project_name || "";
            const leadName = project?.lead_name || "";

            const existing =
              agentScoreMap.get(projectId) ||
              ({
                projectName,
                leadName,
                total: 0,
                count: 0,
                agentIds: new Set<string>(),
              } as const);

            // If this project name/lead name wasn't present in the first row we saw, backfill it.
            // (This helps when some rows are missing joined project data.)
            const projectNameFinal = existing.projectName || projectName;
            const leadNameFinal = existing.leadName || leadName;

            const next = {
              projectName: projectNameFinal,
              leadName: leadNameFinal,
              total: existing.total + numericScore,
              count: existing.count + 1,
              agentIds: existing.agentIds,
            };
            if (agentId) next.agentIds.add(agentId);

            agentScoreMap.set(projectId, next);
          });

          const agentScoreRows: AgentProjectScore[] = Array.from(
            agentScoreMap.entries()
          ).map(([projectId, agg]) => ({
            projectId,
            projectName: agg.projectName,
            leadName: agg.leadName,
            totalScore: agg.total,
            numberOfSessions: agg.count,
            numberOfAgents: agg.agentIds.size,
            averageScore: agg.count > 0 ? agg.total / agg.count : 0,
          }));

          agentScoreRows.sort((a, b) => b.averageScore - a.averageScore);
          setAgentScores(agentScoreRows);
        } catch (err) {
          console.error("Error fetching agent scores (meetings):", err);
          setAgentScores([]);
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
          setTrackScores({});
          setRawScoreData([]);
          return;
        }

        const scoreRows = (data || []) as ProjectScoreQueryRow[];

        // Transform data for display (existing logic)
        const displayData = scoreRows.map((item: ProjectScoreQueryRow) => {
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

        // Store raw data for exports
        const rawData: RawScoreData[] = scoreRows.map((item: ProjectScoreQueryRow) => {
          const projects = Array.isArray(item.projects)
            ? item.projects[0]
            : item.projects;
          const eventTracks = Array.isArray(item.event_tracks)
            ? item.event_tracks[0]
            : item.event_tracks;

          return {
            scores: item.scores as Record<string, string | number>,
            comments: item.comments,
            projects: {
              project_name: projects?.project_name || "",
              lead_email: projects?.lead_email || "",
            },
            event_tracks: {
              name: eventTracks?.name || "",
            },
          };
        });

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
  }, [eventId, calculateTrackScores]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="judge-scores" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="judge-scores" className="flex items-center gap-2">
            <Gavel className="w-4 h-4" />
            Judge Scores
          </TabsTrigger>
          <TabsTrigger value="agent-scores" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Agent Scores
          </TabsTrigger>
          <TabsTrigger value="peoples-choice" className="flex items-center gap-2">
            <Vote className="w-4 h-4" />
            People&apos;s Choice
          </TabsTrigger>
        </TabsList>

        {/* Judge Scores Tab */}
        <TabsContent value="judge-scores" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Judge Scoring Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Live Judge Scores</h3>
                  <div className="flex space-x-2">
                    <Button onClick={exportRawData} variant="outline" size="sm" disabled={loading}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Raw Data
                    </Button>
                    <Button onClick={exportScores} variant="outline" size="sm" disabled={loading}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Tables
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-8">Loading scores...</div>
                ) : (
                  <div className="space-y-6">
                    {Object.keys(trackScores).length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">No judge scores available yet.</p>
                      </div>
                    ) : (
                      <>
                        {Object.entries(trackScores).map(([trackId, scores]) => {
                          // Find the corresponding track name
                          const trackName =
                            eventTracks.find((t) => t.track_id === trackId)?.name ||
                            Object.values(scoringConfig.tracks).find((t) =>
                              trackId.includes(t.name)
                            )?.name ||
                            trackId;

                          const choiceCriteria =
                            scoringConfig.tracks[trackId]?.criteria.filter(
                              (c) => c.type === "multiplechoice"
                            ) || [];

                          const numericCriteria =
                            scoringConfig.tracks[trackId]?.criteria.filter(
                              (c) => c.type !== "multiplechoice"
                            ) || [];

                          return (
                            <Card key={trackId} className="overflow-hidden">
                              <div className="bg-primary text-primary-foreground p-4">
                                <h3 className="text-lg font-medium">
                                  {trackName} Track
                                </h3>
                              </div>
                              <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-16 text-center">
                                          Rank
                                        </TableHead>
                                        <TableHead className="min-w-[150px] max-w-[200px]">
                                          Project
                                        </TableHead>
                                        <TableHead className="min-w-[120px] max-w-[150px]">
                                          Lead
                                        </TableHead>
                                        <TableHead className="text-right min-w-[100px] px-4">
                                          Total Average
                                        </TableHead>
                                        {numericCriteria.map((c) => (
                                          <TableHead
                                            key={c.id}
                                            className="text-right min-w-[100px] max-w-[120px] px-4"
                                          >
                                            <div className="break-words">
                                              {c.name}
                                              {c.weight && c.weight !== 1 && (
                                                <span className="text-xs text-muted-foreground ml-1">
                                                  (×{c.weight})
                                                </span>
                                              )}
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
                                        <TableHead className="text-center w-20 px-4">
                                          Judges
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {scores.map((score, index) => (
                                        <TableRow key={score.projectId}>
                                          <TableCell className="font-medium w-16 text-center">
                                            {index + 1}
                                          </TableCell>
                                          <TableCell className="min-w-[150px] max-w-[200px]">
                                            <div className="break-words">
                                              {score.projectName}
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
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
              ) : agentScores.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">
                    No agent scores available yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 text-center">Rank</TableHead>
                        <TableHead className="min-w-[200px]">
                          Project
                        </TableHead>
                        <TableHead className="min-w-[160px]">Lead</TableHead>
                        <TableHead className="text-right min-w-[120px] px-4">
                          Agent Average
                        </TableHead>
                        <TableHead className="text-center w-24 px-4">
                          Sessions
                        </TableHead>
                        <TableHead className="text-center w-24 px-4">
                          Agents
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentScores.map((row, index) => (
                        <TableRow key={row.projectId}>
                          <TableCell className="font-medium w-16 text-center">
                            {index + 1}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <div className="break-words">{row.projectName}</div>
                          </TableCell>
                          <TableCell className="min-w-[160px]">
                            <div className="break-words">{row.leadName}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium min-w-[120px] px-4 tabular-nums">
                            {row.averageScore.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center w-24 px-4 tabular-nums">
                            {row.numberOfSessions}
                          </TableCell>
                          <TableCell className="text-center w-24 px-4 tabular-nums">
                            {row.numberOfAgents}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
