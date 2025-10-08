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
import { Delete, EmojiEvents, Close } from "@mui/icons-material";
import { EventDetails, Prize, Project } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface ExtendedPrize extends Prize {
  prize_winners?: {
    id: string;
    project_id: string;
    assigned_at: string;
    assigned_by: string;
    projects: Project;
  }[];
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
  isArchived: boolean;
}

export function PrizesTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
  isArchived,
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
        const projectsResponse = await fetch(
          `/api/projects?eventId=${event.event_id}`
        );
        if (!projectsResponse.ok) {
          throw new Error("Failed to fetch projects");
        }
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.projects || []);

        // Fetch prizes using API route
        const prizesResponse = await fetch(
          `/api/prizes?eventId=${event.event_id}`
        );
        if (!prizesResponse.ok) {
          throw new Error("Failed to fetch prizes");
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
        prev.map((prize) => {
          if (prize.id === prizeId) {
            if (projectId) {
              // Add new winner
              const newWinner = {
                id: data.winnerId,
                project_id: projectId,
                assigned_at: new Date().toISOString(),
                assigned_by: data.assignedBy,
                projects: projects.find((p) => p.id === projectId)!,
              };
              return {
                ...prize,
                prize_winners: [...(prize.prize_winners || []), newWinner],
              };
            }
          }
          return prize;
        })
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

  const handleRemoveWinner = async (prizeId: string, projectId: string) => {
    try {
      setSaving(true);

      const response = await fetch("/api/prizes/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeId, projectId: null }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove winner");
      }

      // Update local state to remove the specific winner
      setPrizesWithWinners((prev) =>
        prev.map((prize) => {
          if (prize.id === prizeId) {
            return {
              ...prize,
              prize_winners:
                prize.prize_winners?.filter(
                  (w) => w.project_id !== projectId
                ) || [],
            };
          }
          return prize;
        })
      );

      toast({
        title: "Success",
        description: "Winner removed successfully",
      });
    } catch (error) {
      console.error("Error removing winner:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove winner",
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

      // Separate local prizes (new) from database prizes (existing)
      const databasePrizes: Prize[] = [];
      const localPrizes: Prize[] = [];
      const localPrizeTrackMap: Record<string, string> = {}; // Map local prize ID to track ID

      for (const track of event.event_tracks) {
        if (track.prizes && track.prizes.length > 0) {
          for (const prize of track.prizes) {
            const prizeData = {
              id: prize.id,
              track_id: track.track_id,
              prize_amount: prize.prize_amount,
              prize_description: prize.prize_description,
            };

            if (isDatabasePrize(prize.id)) {
              databasePrizes.push(prizeData);
            } else {
              localPrizes.push({
                ...prizeData,
                id: crypto.randomUUID(), // Let database generate new ID
              });
              localPrizeTrackMap[prize.id] = track.track_id;
            }
          }
        }
      }

      // Save database prizes (updates)
      if (databasePrizes.length > 0) {
        const updateResponse = await fetch("/api/prizes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prizes: databasePrizes,
            eventId: event.event_id,
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(
            errorData.error || "Failed to update existing prizes"
          );
        }
      }

      // Save local prizes (creates)
      if (localPrizes.length > 0) {
        const createResponse = await fetch("/api/prizes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prizes: localPrizes,
            eventId: event.event_id,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(errorData.error || "Failed to create new prizes");
        }

        const createData = await createResponse.json();
        const newPrizes = createData.prizes || [];

        // Update local state to replace local IDs with database IDs
        const newTracks = [...event.event_tracks!];
        const localPrizeIds = Object.keys(localPrizeTrackMap);

        // Create a mapping of track_id to new prizes for that track
        const newPrizesByTrack: Record<string, Prize[]> = {};
        newPrizes.forEach((newPrize: Prize) => {
          if (!newPrizesByTrack[newPrize.track_id]) {
            newPrizesByTrack[newPrize.track_id] = [];
          }
          newPrizesByTrack[newPrize.track_id].push(newPrize);
        });

        // Replace local prizes with database prizes in each track
        for (const trackId of Object.keys(newPrizesByTrack)) {
          const trackIndex = newTracks.findIndex((t) => t.track_id === trackId);
          if (trackIndex > -1 && newTracks[trackIndex].prizes) {
            // Find local prizes for this track
            const localPrizesForTrack = localPrizeIds.filter(
              (id) => localPrizeTrackMap[id] === trackId
            );
            let newPrizeIndex = 0;

            // Replace local prizes with new database prizes
            newTracks[trackIndex].prizes = newTracks[trackIndex].prizes!.map(
              (prize) => {
                if (localPrizesForTrack.includes(prize.id)) {
                  const newPrize = newPrizesByTrack[trackId][newPrizeIndex];
                  newPrizeIndex++;
                  return {
                    ...prize,
                    id: newPrize.id,
                  };
                }
                return prize;
              }
            );
          }
        }

        setEvent({ ...event, event_tracks: newTracks });
      }

      // Refresh the prizes data to get the latest state
      const updatedPrizesResponse = await fetch(
        `/api/prizes?eventId=${event.event_id}`
      );
      if (updatedPrizesResponse.ok) {
        const updatedPrizesData = await updatedPrizesResponse.json();
        setPrizesWithWinners(updatedPrizesData.prizes || []);
      }

      toast({
        title: "Success",
        description: "Prizes updated successfully",
      });
    } catch (error) {
      console.error("Error updating prizes:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update prizes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper function to check if a prize is saved to database
  const isDatabasePrize = (prizeId: string) => !prizeId.startsWith("local-");

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
                        <EmojiEvents className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium text-sm">
                          Prize {prizeIndex + 1}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={isArchived}
                        size="sm"
                        onClick={async () => {
                          if (isDatabasePrize(prize.id)) {
                            try {
                              setSaving(true);
                              const response = await fetch(
                                `/api/prizes?prizeId=${prize.id}`,
                                {
                                  method: "DELETE",
                                }
                              );

                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(
                                  errorData.error || "Failed to delete prize"
                                );
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
                                description:
                                  error instanceof Error
                                    ? error.message
                                    : "Failed to delete prize",
                                variant: "destructive",
                              });
                            } finally {
                              setSaving(false);
                            }
                          } else {
                            // Just remove from local state if local prize (not saved to DB yet)
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
                        <Delete className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prize Amount</Label>
                        <Input
                          value={prize.prize_amount}
                          disabled={isArchived}
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
                          disabled={isArchived}
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
                    {isDatabasePrize(prize.id) && (
                      <div className="space-y-2 border-t pt-4 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <EmojiEvents className="h-4 w-4 text-yellow-500" />
                            <Label>Winner Assignment</Label>
                          </div>
                          {prizesWithWinners.find((p) => p.id === prize.id)
                            ?.prize_winners &&
                            prizesWithWinners.find((p) => p.id === prize.id)!
                              .prize_winners!.length > 0 && (
                              <Badge
                                variant="secondary"
                                className="bg-yellow-100 text-yellow-800"
                              >
                                {
                                  prizesWithWinners.find(
                                    (p) => p.id === prize.id
                                  )?.prize_winners?.length
                                }{" "}
                                Winners
                              </Badge>
                            )}
                        </div>

                        <div className="flex gap-2">
                          <Select
                            value="none"
                            onValueChange={(value) =>
                              handleAssignPrize(
                                prize.id,
                                value === "none" ? null : value
                              )
                            }
                            disabled={saving || loadingProjects || isArchived}
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
                                    ? <Loader2 className="h-4 w-4 animate-spin text-blue-900" />
                                    : "No projects found"}
                                </SelectItem>
                              ) : (
                                projects
                                  .filter((project) =>
                                    project.track_ids?.includes(track.track_id)
                                  )
                                  .filter(
                                    (project) =>
                                      !prizesWithWinners
                                        .find((p) => p.id === prize.id)
                                        ?.prize_winners?.some(
                                          (w) => w.project_id === project.id
                                        )
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
                        </div>

                        {/* Display current winners */}
                        {prizesWithWinners
                          .find((p) => p.id === prize.id)
                          ?.prize_winners?.map((winner) => (
                            <div
                              key={winner.id}
                              className="p-3 bg-green-50 rounded-lg border border-green-200"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-green-800">
                                    🏆 {winner.projects.project_name}
                                  </div>
                                  <div className="text-xs text-green-600">
                                    Led by {winner.projects.lead_name}
                                  </div>
                                  <div className="text-xs text-green-500 mt-1">
                                    Assigned{" "}
                                    {new Date(
                                      winner.assigned_at
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleRemoveWinner(
                                      prize.id,
                                      winner.project_id
                                    )
                                  }
                                  disabled={saving || isArchived}
                                  title="Remove winner"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Close className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
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
                      id: `local-${crypto.randomUUID()}`,
                      track_id: track.track_id,
                      prize_amount: "",
                      prize_description: "",
                    });
                    setEvent({ ...event, event_tracks: newTracks });
                  }
                }}
                disabled={isArchived}
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

      <Button onClick={handlePrizesUpdate} disabled={saving || isArchived} className="w-full">
        {saving ? "Saving..." : "Save All Prizes"}
      </Button>
    </div>
  );
}
