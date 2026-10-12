import React, { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Loader,
  Trophy,
  CalendarClock,
  ThumbsUp,
  User,
  MoreHorizontal,
  MessageSquare,
  Trash2,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/hooks/use-toast";
import QRCode from "react-qr-code";

import { Project, ProjectBoardContext } from "@/lib/types";
import { CoverImageWithFallback } from "@/features/projects/components/displays/cover-image-with-fallback";

export interface ProjectBoardProps {
  isLoading: boolean;
  projectList: Project[];
  session?: import("@supabase/supabase-js").Session | null;
  projectBoardContext: ProjectBoardContext;
  onProjectDeleted?: (projectId: string) => void;
}

const ProjectBoard = ({
  isLoading,
  projectList,
  session,
  projectBoardContext,
  onProjectDeleted,
}: ProjectBoardProps) => {
  const [qrDialogOpen, setQrDialogOpen] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

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
          className="mx-auto w-full"
        >
          {projectList.length > 0 ? (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,280px),339px))] sm:justify-start sm:gap-x-4 sm:gap-y-5 auto-rows-fr">
              {projectList.map((project) => {
                const projectUrl =
                  projectBoardContext === ProjectBoardContext.MyProjects
                    ? `/projects/${project.id}`
                    : `/projects/public/${project.id}`;

                const isOwner = project.lead_email === session?.user?.email;

                return (
                  <Link
                    href={projectUrl}
                    key={project.id}
                    className="block group h-full w-full max-w-[339px] justify-self-center sm:max-w-none sm:justify-self-stretch"
                  >
                    <Card
                      className={`bg-white rounded-[12px] overflow-hidden relative flex flex-col h-full hover:shadow-xl transition-all duration-300 border border-gray-100 ${
                        project.prizes_won && project.prizes_won.length > 0
                          ? "ring-2 ring-yellow-400"
                          : ""
                      }`}
                    >
                      {/* Winner Banner */}
                      {project.prizes_won && project.prizes_won.length > 0 && (
                        <div className="absolute top-4 left-4 right-4 z-20">
                          <div className="bg-white/95 backdrop-blur-sm border-2 border-yellow-400 text-yellow-700 py-2 px-4 flex items-center justify-center rounded-lg">
                            <Trophy className="h-4 w-4 mr-2 text-yellow-600" />
                            <span className="font-semibold text-sm">
                              {project.prizes_won.length === 1
                                ? "Winner"
                                : `${project.prizes_won.length} Prizes Won`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Thumbnail Section - same aspect as event card (335/223) */}
                      <div className="relative w-full aspect-[335/223] bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 overflow-hidden">
                        <CoverImageWithFallback
                          src={project.cover_image_url}
                          alt={`${project.project_name || "Project"} thumbnail`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          decoding="async"
                        />
                        {!project.cover_image_url && (
                          <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/25">
                            <h3 className="text-white text-xl font-semibold text-center break-words drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
                              {project.project_name || "Project"}
                            </h3>
                          </div>
                        )}

                        {/* Status Badges - Overlay on Image */}
                        <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-700 px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1.5">
                            {project.submitted ? <Sparkles className="w-3 h-3" /> : <Loader className="w-3 h-3 animate-spin" />}
                            {project.submitted ? "Submitted" : "Draft"}
                          </div>
                          {isOwner && (
                            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-700 px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1.5">
                              <User className="w-3 h-3" />
                              Owner
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content Section - padding aligned with event card */}
                      <div className="px-6 py-4 flex-1 flex flex-col bg-white">
                        {/* Project Title */}
                        <h3 className="font-bold text-gray-900 text-xl leading-tight mb-2 line-clamp-2">
                          {project.project_name || "Project"}
                        </h3>

                        {/* Description */}
                        {project.project_description && (
                          <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2 flex-1">
                            {project.project_description}
                          </p>
                        )}

                        {/* Metadata Row */}
                        <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <CalendarClock className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">
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
                          <div className="flex items-center gap-1.5">
                            <ThumbsUp className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">0</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">0</span>
                          </div>
                        </div>

                        {/* Footer: QR Button, Avatars, Menu */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-3">
                            {/* QR Code Button */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQrDialogOpen(project.id);
                              }}
                              className="w-9 h-9 rounded-full bg-[#4b89ef] hover:bg-[#3a6fd8] flex items-center justify-center text-white font-semibold text-sm transition-all duration-200 hover:scale-110 shadow-sm"
                              title="Share QR Code"
                            >
                              Q
                            </button>

                            {/* Avatar Stack */}
                            <div className="flex items-center -space-x-2">
                              <div
                                className="w-9 h-9 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm"
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
                                      className={`w-9 h-9 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br ${colors[i % colors.length]} flex items-center justify-center text-white font-semibold text-xs shadow-sm`}
                                      title={t}
                                    >
                                      {t.charAt(0).toUpperCase()}
                                    </div>
                                  );
                                })}
                              {project.teammates &&
                                project.teammates.length > 3 && (
                                  <div className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-600 font-medium shadow-sm">
                                    +{project.teammates.length - 3}
                                  </div>
                                )}
                            </div>
                          </div>

                          {/* Three dots menu – only on My Projects */}
                          {projectBoardContext ===
                            ProjectBoardContext.MyProjects && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.preventDefault()}
                              >
                                <button className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                                className="w-40"
                              >
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(projectUrl, "_blank");
                                  }}
                                >
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setQrDialogOpen(project.id);
                                  }}
                                >
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
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
                      <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[rgba(0,0,0,0.15)] rounded-[20px] p-8">
                        <div className="text-center space-y-3 flex flex-col items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="30"
                            height="30"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M11 3V11L14 8L17 11V3M5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z"
                              stroke="#09090B"
                            ></path>
                          </svg>
                          <h3 className="text-xl font-semibold text-gray-700">
                            No project yet
                          </h3>
                          <p className="text-gray-500 max-w-sm">
                            Join the event to submit a project or create a
                            project directly.
                          </p>
                          <Button className="mt-4">
                            <Link href="/projects/submit">
                              Submit a project
                            </Link>
                          </Button>
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
                const projectIdToDelete = deleteDialogOpen;
                setIsDeleting(true);
                try {
                  const response = await fetch(
                    `/api/projects/${projectIdToDelete}`,
                    { method: "DELETE" }
                  );
                  if (!response.ok) throw new Error("Failed to delete project");

                  toast({
                    title: "Success",
                    description: "Project deleted successfully",
                  });
                  setDeleteDialogOpen(null);
                  onProjectDeleted?.(projectIdToDelete);
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
    </>
  );
};

export default ProjectBoard;
