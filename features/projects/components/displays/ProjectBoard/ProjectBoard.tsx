import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Loader,
  Loader2,
  Trophy,
  CalendarClock,
  ThumbsUp,
  User,
  MoreHorizontal,
  MessageSquare,
  QrCode,
  ExternalLink,
  Trash2,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/hooks/use-toast";
import QRCode from "react-qr-code";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Project, ProjectBoardContext } from "@/lib/types";

interface AssignableEvent {
  event_id: string;
  event_name: string;
  slug?: string | null;
  submission_time_cutoff?: string | null;
}

export interface ProjectBoardProps {
  isLoading: boolean;
  projectList: Project[];
  session?: import("@supabase/supabase-js").Session | null;
  projectBoardContext: ProjectBoardContext;
}

const ProjectBoard = ({
  isLoading,
  projectList,
  session,
  projectBoardContext,
}: ProjectBoardProps) => {
  const [qrDialogOpen, setQrDialogOpen] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [assignDialogProject, setAssignDialogProject] = useState<Project | null>(
    null
  );
  const [assignableEvents, setAssignableEvents] = useState<AssignableEvent[]>(
    []
  );
  const [assignableEventsLoading, setAssignableEventsLoading] = useState(false);
  const [assignableEventsError, setAssignableEventsError] = useState<
    string | null
  >(null);
  const [selectedAssignEventId, setSelectedAssignEventId] = useState<
    string | null
  >(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!assignDialogProject) {
      setSelectedAssignEventId(null);
      setAssignableEventsError(null);
      return;
    }

    setSelectedAssignEventId(assignDialogProject.event_id || null);
    const loadEvents = async () => {
      setAssignableEventsLoading(true);
      setAssignableEventsError(null);
      try {
        const response = await fetch("/api/events/assignable", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to load events");
        }
        const data = await response.json();
        setAssignableEvents(data.events || []);
      } catch (error) {
        console.error("Failed to load assignable events", error);
        setAssignableEvents([]);
        setAssignableEventsError("Unable to load your active events right now.");
      } finally {
        setAssignableEventsLoading(false);
      }
    };

    loadEvents();
  }, [assignDialogProject]);

  const assignDialogTitle = assignDialogProject
    ? `Assign "${assignDialogProject.project_name || "project"}"`
    : "Assign to event";
  const assignDialogDescription =
    "Only events you have joined as a participant with an open submission window appear here.";

  return (
    <>
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="h-12 w-12 animate-spin text-blue-400" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto"
        >
          {projectList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-[24px]">
              {projectList.map((project) => {
                const projectUrl =
                  projectBoardContext === ProjectBoardContext.MyProjects
                    ? `/projects/${project.id}`
                    : `/projects/public/${project.id}`;

                const isOwner = project.lead_email === session?.user?.email;

                return (
                  <Link href={projectUrl} key={project.id} className="block">
                    <Card
                      className={`bg-white rounded-xl overflow-hidden relative flex flex-col h-full hover:shadow-lg transition-shadow ${
                        project.prizes_won && project.prizes_won.length > 0
                          ? "ring-2 ring-yellow-400"
                          : ""
                      }`}
                    >
                      {/* Winner Banner */}
                      {project.prizes_won && project.prizes_won.length > 0 && (
                        <div className="absolute top-4 left-4 right-4 z-20">
                          <div className="bg-white border-2 border-yellow-400 text-yellow-700 py-2 px-4 flex items-center justify-center shadow-lg rounded-lg">
                            <Trophy className="h-4 w-4 mr-2 text-yellow-600" />
                            <span className="font-semibold text-sm">
                              {project.prizes_won.length === 1
                                ? "Winner"
                                : `${project.prizes_won.length} Prizes Won`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Thumbnail (top half) – using <img>, no next/image */}
                      <div className="relative w-full aspect-[16/9] md:aspect-[4/3] bg-slate-100">
                        <img
                          src={
                            project.cover_image_url || "/img/placeholder.png"
                          }
                          alt={`${project.project_name || "Project"} thumbnail`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        {!project.cover_image_url && (
                          <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-br from-gray-500/60 to-gray-700/60">
                            <h3 className="text-white text-xl font-semibold text-center break-words">
                              {project.project_name || "Project"}
                            </h3>
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
                      </div>

                      {/* Lower content */}
                      <div className="p-6 flex-1 flex flex-col">
                        {/* Project name + status chips */}
                        <div className="flex items-start justify-between mb-4 gap-2">
                          <h3 className="font-bold text-black flex-1 min-w-0 truncate">
                            {project.project_name || "Project"}
                          </h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="bg-transparent border border-gray-300 text-gray-700 px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 whitespace-nowrap">
                              <Sparkles className="w-3 h-3" />
                              {project.submitted ? "Submitted" : "Draft"}
                            </div>
                            {isOwner && (
                              <div className="bg-transparent border border-gray-300 text-gray-700 px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 whitespace-nowrap">
                                <User className="w-3 h-3" />
                                Owner
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {project.project_description && (
                          <p className="text-gray-800 text-sm leading-relaxed mb-4 line-clamp-2">
                            {project.project_description}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4" />
                            <span>
                              {project.created_at
                                ? new Date(
                                    project.created_at
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ThumbsUp className="w-4 h-4" />
                            <span>0</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>0</span>
                          </div>
                        </div>

                        {/* Avatars + menu */}
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center -space-x-2">
                            <div
                              className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs"
                              title={project.lead_name || "Lead"}
                            >
                              {project.lead_name?.charAt(0).toUpperCase() ||
                                "L"}
                            </div>
                            {project.teammates &&
                              project.teammates.slice(0, 3).map((t, i) => {
                                const colors = [
                                  "from-purple-400 to-purple-600",
                                  "from-pink-400 to-pink-600",
                                  "from-orange-400 to-orange-600",
                                ];
                                return (
                                  <div
                                    key={i}
                                    className={`w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br ${colors[i % colors.length]} flex items-center justify-center text-white font-semibold text-xs`}
                                    title={t}
                                  >
                                    {t.charAt(0).toUpperCase()}
                                  </div>
                                );
                              })}
                            {project.teammates &&
                              project.teammates.length > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-600 font-medium">
                                  +{project.teammates.length - 3}
                                </div>
                              )}
                          </div>

                          {/* Three dots menu – only on My Projects */}
                          {projectBoardContext ===
                            ProjectBoardContext.MyProjects && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.preventDefault()}
                              >
                                <button className="p-1 hover:bg-gray-100 rounded-full">
                                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setQrDialogOpen(project.id);
                                  }}
                                >
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Show QR Code
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(
                                      `/projects/public/${project.id}`,
                                      "_blank"
                                    );
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Feedback Page
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setAssignDialogProject(project);
                                    }}
                                  >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Assign to event
                                  </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteDialogOpen(project.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Project
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <>
              {(() => {
                switch (projectBoardContext) {
                  case ProjectBoardContext.MyProjects:
                    return (
                      <div className="flex flex-col items-center justify-center mt-12">
                        <h3 className="text-xl font-semibold text-gray-700">
                          No Projects Found
                        </h3>
                        <p className="text-gray-500 mt-2">
                          You are not currently part of any projects.
                        </p>
                      </div>
                    );
                  case ProjectBoardContext.EventGallery:
                    return (
                      <div className="flex flex-col items-center justify-center space-y-4 mt-12">
                        <div className="text-center space-y-3">
                          <h3 className="text-xl font-semibold text-gray-700">
                            No Projects Found
                          </h3>
                          <p className="text-gray-500 max-w-sm">
                            Try adjusting your search criteria or be the first
                            to submit a project!
                          </p>
                        </div>
                      </div>
                    );
                }
              })()}
            </>
          )}
        </motion.div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!qrDialogOpen} onOpenChange={() => setQrDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDialogOpen && (
              <>
                <div className="bg-white p-4 rounded-lg border">
                  <QRCode
                    value={`${
                      typeof window !== "undefined"
                        ? window.location.origin
                        : ""
                    }/projects/public/${qrDialogOpen}`}
                    size={200}
                  />
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Scan this QR code to view the project feedback page
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteDialogOpen}
        onOpenChange={() => setDeleteDialogOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete this project? This action cannot
              be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteDialogOpen) return;
                setIsDeleting(true);
                try {
                  const response = await fetch(
                    `/api/projects/${deleteDialogOpen}`,
                    { method: "DELETE" }
                  );
                  if (!response.ok) throw new Error("Failed to delete project");

                  toast({
                    title: "Success",
                    description: "Project deleted successfully",
                  });
                  setDeleteDialogOpen(null);
                  router.refresh();
                } catch {
                  toast({
                    title: "Error",
                    description: "Failed to delete project. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* Assign to Event Dialog */}
        <Dialog
          open={!!assignDialogProject}
          onOpenChange={() => {
            if (isAssigning) return;
            setAssignDialogProject(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{assignDialogTitle}</DialogTitle>
              <DialogDescription>{assignDialogDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {assignableEventsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading events...
                </div>
              ) : (
                <>
                  <label className="text-sm font-medium text-gray-700">
                    Choose an event
                  </label>
                  <Select
                    value={selectedAssignEventId || undefined}
                    onValueChange={(value) => setSelectedAssignEventId(value)}
                    disabled={assignableEvents.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {assignableEvents.map((event) => (
                          <SelectItem key={event.event_id} value={event.event_id}>
                            <div className="flex flex-col text-left">
                              <span className="font-medium">
                                {event.event_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {event.submission_time_cutoff
                                  ? `Deadline: ${new Date(
                                      event.submission_time_cutoff
                                    ).toLocaleString()}`
                                  : "No submission deadline"}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {assignableEvents.length === 0 && !assignableEventsError && (
                    <p className="text-sm text-muted-foreground">
                      You do not have any active events with open submissions.
                    </p>
                  )}
                  {assignableEventsError && (
                    <p className="text-sm text-red-500">
                      {assignableEventsError}
                    </p>
                  )}
                </>
              )}
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (isAssigning) return;
                  setAssignDialogProject(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!assignDialogProject || !selectedAssignEventId) {
                    toast({
                      title: "Select an event",
                      description: "Choose an event to assign this project to.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsAssigning(true);
                  try {
                    const response = await fetch(
                      `/api/projects/${assignDialogProject.id}`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          event_id: selectedAssignEventId,
                        }),
                      }
                    );
                    if (!response.ok) {
                      throw new Error("Failed to assign project");
                    }
                    toast({
                      title: "Project assigned",
                      description:
                        "Your project is now linked to the selected event.",
                    });
                    setAssignDialogProject(null);
                    router.refresh();
                  } catch (error) {
                    console.error("Assignment error", error);
                    toast({
                      title: "Assignment failed",
                      description:
                        "We ran into an issue assigning this project. Try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsAssigning(false);
                  }
                }}
                disabled={
                  !selectedAssignEventId ||
                  assignableEventsLoading ||
                  isAssigning
                }
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign to event"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
};

export default ProjectBoard;
