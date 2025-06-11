"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrashIcon, Trophy, X } from "lucide-react";
import { EventDetails, Prize, Project } from "@/lib/types";

interface ExtendedPrize extends Prize {
  winning_project?: Project;
}

interface PrizesTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: (props: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void;
}

export function PrizesTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
}: PrizesTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [prizesWithWinners, setPrizesWithWinners] = useState<ExtendedPrize[]>(
    []
  );
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch projects and prizes with winners
  useEffect(() => {
    async function fetchProjectsAndPrizes() {
      if (!event) return;

      setLoadingProjects(true);
      try {
        // Fetch projects using API route
        const projectsResponse = await fetch(`/api/projects?eventId=${event.event_id}`);
        if (!projectsResponse.ok) {
          throw new Error('Failed to fetch projects');
        }
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.projects || []);

        // Fetch prizes using API route
        const prizesResponse = await fetch(`/api/prizes?eventId=${event.event_id}`);
        if (!prizesResponse.ok) {
          throw new Error('Failed to fetch prizes');
        }
        const prizesData = await prizesResponse.json();
        setPrizesWithWinners(prizesData.prizes || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load projects and prizes",
          variant: "destructive",
        });
      } finally {
        setLoadingProjects(false);
      }
    }

    fetchProjectsAndPrizes();
  }, [event, toast]);

  const handleAssignPrize = async (
    prizeId: string,
    projectId: string | null
  ) => {
    try {
      setSaving(true);

      const response = await fetch("/api/prizes/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeId, projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign prize");
      }

      // Update local state
      setPrizesWithWinners((prev) =>
        prev.map((prize) =>
          prize.id === prizeId
            ? {
                ...prize,
                winning_project_id: projectId,
                winning_project: projectId
                  ? projects.find((p) => p.id === projectId)
                  : undefined,
                assigned_at: projectId ? new Date().toISOString() : null,
              }
            : prize
        )
      );

      toast({
        title: "Success",
        description: projectId
          ? "Prize assigned successfully"
          : "Prize unassigned successfully",
      });
    } catch (error) {
      console.error("Error assigning prize:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to assign prize",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const handlePrizesUpdate = async () => {
    if (!event || !event.event_tracks || event.event_tracks.length === 0)
      return;

    try {
      setSaving(true);

      // Collect all prizes from all tracks
      const allPrizes: any[] = [];
      for (const track of event.event_tracks) {
        if (track.prizes && track.prizes.length > 0) {
          const trackPrizes = track.prizes.map((prize) => ({
            id: prize.id,
            track_id: track.track_id,
            prize_amount: prize.prize_amount,
            prize_description: prize.prize_description,
          }));
          allPrizes.push(...trackPrizes);
        }
      }

      // Send prizes to API route
      const response = await fetch('/api/prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prizes: allPrizes,
          eventId: event.event_id 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save prizes');
      }

      // Refresh the event data by fetching updated tracks
      const tracksResponse = await fetch(`/api/events/${event.event_id}/tracks`);
      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        setEvent({
          ...event,
          event_tracks: tracksData.tracks,
        });
      }

      toast({
        title: "Success",
        description: "Prizes updated successfully",
      });
    } catch (error) {
      console.error("Error updating prizes:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update prizes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground mb-6">
        Configure prizes for each track. Prizes can be monetary amounts,
        descriptions of awards, or other incentives.
      </p>

      {event.event_tracks && event.event_tracks.length > 0 ? (
        event.event_tracks.map((track) => (
          <Card key={track.track_id} className="p-4 border-2 border-blue-400">
            <CardHeader>
              <CardTitle>{track.name}</CardTitle>
              <CardDescription>{track.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {track.prizes &&
                track.prizes.map((prize, prizeIndex) => (
                  <div
                    key={prize.id || prizeIndex}
                    className="border rounded-lg p-4 space-y-4"
                  >
                    {/* Prize Header with Delete Button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium text-sm">
                          Prize {prizeIndex + 1}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (prize.id) {
                            try {
                              setSaving(true);
                              const response = await fetch(`/api/prizes?prizeId=${prize.id}`, {
                                method: 'DELETE',
                              });

                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to delete prize');
                              }

                              const newTracks = [...event.event_tracks!];
                              const trackIndex = newTracks.findIndex(
                                (t) => t.track_id === track.track_id
                              );
                              if (
                                trackIndex > -1 &&
                                newTracks[trackIndex].prizes
                              ) {
                                newTracks[trackIndex].prizes = newTracks[
                                  trackIndex
                                ].prizes!.filter((p) => p.id !== prize.id);
                                setEvent({
                                  ...event,
                                  event_tracks: newTracks,
                                });
                              }

                              toast({
                                title: "Prize deleted",
                                description:
                                  "Prize has been removed successfully",
                              });
                            } catch (error) {
                              console.error("Error deleting prize:", error);
                              toast({
                                title: "Error",
                                description: error instanceof Error ? error.message : "Failed to delete prize",
                                variant: "destructive",
                              });
                            } finally {
                              setSaving(false);
                            }
                          } else {
                            // Just remove from local state if no ID (not saved to DB yet)
                            const newTracks = [...event.event_tracks!];
                            const trackIndex = newTracks.findIndex(
                              (t) => t.track_id === track.track_id
                            );
                            if (
                              trackIndex > -1 &&
                              newTracks[trackIndex].prizes
                            ) {
                              newTracks[trackIndex].prizes = newTracks[
                                trackIndex
                              ].prizes!.filter((_, i) => i !== prizeIndex);
                              setEvent({
                                ...event,
                                event_tracks: newTracks,
                              });
                            }
                          }
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prize Amount</Label>
                        <Input
                          value={prize.prize_amount}
                          onChange={(e) => {
                            const newTracks = [...event.event_tracks!];
                            const trackIndex = newTracks.findIndex(
                              (t) => t.track_id === track.track_id
                            );
                            if (
                              trackIndex > -1 &&
                              newTracks[trackIndex].prizes
                            ) {
                              newTracks[trackIndex].prizes![
                                prizeIndex
                              ].prize_amount = e.target.value;
                              setEvent({
                                ...event,
                                event_tracks: newTracks,
                              });
                            }
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={prize.prize_description}
                          onChange={(e) => {
                            const newTracks = [...event.event_tracks!];
                            const trackIndex = newTracks.findIndex(
                              (t) => t.track_id === track.track_id
                            );
                            if (
                              trackIndex > -1 &&
                              newTracks[trackIndex].prizes
                            ) {
                              newTracks[trackIndex].prizes![
                                prizeIndex
                              ].prize_description = e.target.value;
                              setEvent({
                                ...event,
                                event_tracks: newTracks,
                              });
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Winner Assignment Section */}
                    {prize.id && (
                      <div className="space-y-2 border-t pt-4 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <Label>Winner Assignment</Label>
                          </div>
                          {prizesWithWinners.find((p) => p.id === prize.id)
                            ?.winning_project && (
                            <Badge
                              variant="secondary"
                              className="bg-yellow-100 text-yellow-800"
                            >
                              Winner Assigned
                            </Badge>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Select
                            value={
                              prizesWithWinners.find((p) => p.id === prize.id)
                                ?.winning_project_id || "none"
                            }
                            onValueChange={(value) =>
                              handleAssignPrize(
                                prize.id,
                                value === "none" ? null : value
                              )
                            }
                            disabled={saving || loadingProjects}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select winning project..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                No winner assigned
                              </SelectItem>
                              {projects.length === 0 ? (
                                <SelectItem value="loading" disabled>
                                  {loadingProjects
                                    ? "Loading projects..."
                                    : "No projects found"}
                                </SelectItem>
                              ) : (
                                projects
                                  .filter((project) =>
                                    project.track_ids?.includes(track.track_id)
                                  )
                                  .map((project) => (
                                    <SelectItem
                                      key={project.id}
                                      value={project.id}
                                    >
                                      {project.project_name} -{" "}
                                      {project.lead_name}
                                    </SelectItem>
                                  ))
                              )}
                            </SelectContent>
                          </Select>

                          {prizesWithWinners.find((p) => p.id === prize.id)
                            ?.winning_project_id && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleAssignPrize(prize.id, null)}
                              disabled={saving}
                              title="Remove winner"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {prizesWithWinners.find((p) => p.id === prize.id)
                          ?.winning_project && (
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="text-sm font-medium text-green-800">
                              🏆{" "}
                              {
                                prizesWithWinners.find((p) => p.id === prize.id)
                                  ?.winning_project?.project_name
                              }
                            </div>
                            <div className="text-xs text-green-600">
                              Led by{" "}
                              {
                                prizesWithWinners.find((p) => p.id === prize.id)
                                  ?.winning_project?.lead_name
                              }
                            </div>
                            {prizesWithWinners.find((p) => p.id === prize.id)
                              ?.assigned_at && (
                              <div className="text-xs text-green-500 mt-1">
                                Assigned{" "}
                                {new Date(
                                  prizesWithWinners.find(
                                    (p) => p.id === prize.id
                                  )!.assigned_at!
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

              <Button
                variant="outline"
                onClick={() => {
                  const newTracks = [...event.event_tracks!];
                  const trackIndex = newTracks.findIndex(
                    (t) => t.track_id === track.track_id
                  );
                  if (trackIndex > -1) {
                    if (!newTracks[trackIndex].prizes) {
                      newTracks[trackIndex].prizes = [];
                    }
                    newTracks[trackIndex].prizes!.push({
                      id: crypto.randomUUID(),
                      track_id: track.track_id,
                      prize_amount: "",
                      prize_description: "",
                    });
                    setEvent({ ...event, event_tracks: newTracks });
                  }
                }}
              >
                Add Prize to {track.name}
              </Button>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">
              No tracks found. Please add tracks to manage prizes.
            </p>
          </CardContent>
        </Card>
      )}

      <Button onClick={handlePrizesUpdate} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save All Prizes"}
      </Button>
    </div>
  );
}
