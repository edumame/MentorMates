import React, { useState } from "react";

import Link from "next/link";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader, Trophy, CalendarClock, ThumbsUp, User, MoreHorizontal, MessageSquare, QrCode, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCode from "react-qr-code";

import { Project, ProjectBoardContext } from "@/lib/types";

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
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px]">
              {projectList.map((project) => {
                const projectUrl = projectBoardContext === ProjectBoardContext.MyProjects
                  ? `/projects/${project.id}`
                  : `/projects/public/${project.id}`;

                return (
                  <Link href={projectUrl} key={project.id} className="block">
                    <Card
                      className={`bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden relative flex flex-col hover:shadow-lg transition-shadow ${
                        project.prizes_won && project.prizes_won.length > 0
                          ? "ring-2 ring-yellow-400"
                          : ""
                      }`}
                    >
                    {/* Winner Banner - Overlay */}
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

                    {/* Cover Image or Gradient Fallback */}
                    <div
                      className="h-48 w-full relative"
                      style={{
                        backgroundImage: `url(${
                          project.cover_image_url || "/img/placeholder.png"
                        })`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      {!project.cover_image_url && (
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                          <h3 className="text-white text-xl font-semibold text-center break-words">
                            {project.project_name}
                          </h3>
                        </div>
                      )}
                    </div>
                    <div className="px-[24px] py-[16px] flex flex-col gap-[12px]">
                      {/* Content */}
                      <div className="flex flex-col gap-[16px]">
                        {/* Title */}
                        <div className="flex flex-col gap-[8px]">
                          <div className="flex gap-[8px] items-center flex-wrap">
                            <CardTitle className="text-[22px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                              {project.project_name}
                            </CardTitle>
                            {projectBoardContext === ProjectBoardContext.MyProjects && (
                              <>
                                <div className="bg-white border border-[rgba(0,0,0,0.15)] px-[8px] py-[4px] rounded-full flex items-center gap-[4px]">
                                  <Loader className="h-[18px] w-[18px] text-black" />
                                  <span className="text-sm text-black leading-[1.5]">
                                    {project.submitted ? "Public" : "Draft"}
                                  </span>
                                </div>
                                <div className="bg-white border border-[rgba(0,0,0,0.15)] px-[8px] py-[4px] rounded-full flex items-center gap-[4px]">
                                  <User className="h-5 w-5 text-black" />
                                  <span className="text-sm text-black leading-[1.5]">
                                    {project.lead_email === session?.user?.email ? "Owner" : "Team Member"}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                          <p className="text-base text-black leading-[1.5] overflow-hidden h-[48px]" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {project.project_description}
                          </p>
                        </div>

                        {/* Metatags */}
                        <div className="flex flex-wrap gap-[12px] items-center">
                          <div className="flex gap-[4px] items-center">
                            <CalendarClock className="h-5 w-5 text-[#575d65]" />
                            <span className="text-sm text-[#575d65] leading-[1.5]">
                              {project.created_at ? new Date(project.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                          <div className="flex gap-[4px] items-center">
                            <ThumbsUp className="h-5 w-5 text-[#575d65]" />
                            <span className="text-sm text-[#575d65] leading-[1.5]">0</span>
                          </div>
                          <div className="flex gap-[4px] items-center">
                            <MessageSquare className="h-5 w-5 text-[#575d65]" />
                            <span className="text-sm text-[#575d65] leading-[1.5]">0</span>
                          </div>
                        </div>
                      </div>

                      {/* Team Members and More Options */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {/* Placeholder for team member avatars */}
                          <div className="flex items-center -space-x-2">
                            <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white"></div>
                            <div className="w-10 h-10 rounded-full bg-gray-400 border-2 border-white"></div>
                            <div className="w-10 h-10 rounded-full bg-gray-500 border-2 border-white"></div>
                          </div>
                        </div>
                        {projectBoardContext === ProjectBoardContext.MyProjects && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                              <button className="p-0 hover:bg-gray-100 rounded-full p-1 transition-colors">
                                <MoreHorizontal className="h-6 w-6 text-[#7f7f7f]" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQrDialogOpen(project.id);
                              }}>
                                <QrCode className="h-4 w-4 mr-2" />
                                Show QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(`/projects/public/${project.id}`, '_blank');
                              }}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Feedback Page
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
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/projects/public/${qrDialogOpen}`}
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
    </>
  );
};

export default ProjectBoard;
