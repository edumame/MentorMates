"use client";

import { Card } from "@/components/ui/card";
import { Trophy, CalendarClock, User } from "lucide-react";
import { VoteButton } from "./vote-button";
import { Project } from "@/lib/types";
import Link from "next/link";
import { CoverImageWithFallback } from "@/features/projects/components/displays/cover-image-with-fallback";

interface VotableProjectCardProps {
  project: Project;
  hasVoted: boolean;
  toggleVoteAction: () => Promise<boolean>;
  canVote: boolean;
}

export function VotableProjectCard({
  project,
  hasVoted,
  toggleVoteAction,
  canVote,
}: VotableProjectCardProps) {
  return (
    <div className="block">
      <Card
        className={`bg-white rounded-2xl overflow-hidden relative flex flex-col h-full border border-[rgba(0,0,0,0.12)] hover:shadow-xl transition-all duration-200 ${
          project.prizes_won && project.prizes_won.length > 0
            ? "ring-2 ring-yellow-400"
            : ""
        } ${hasVoted ? "ring-2 ring-[#4B89EF]" : ""}`}
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

        {/* Voted Badge */}
        {hasVoted && (
          <div className="absolute top-4 right-4 z-20">
            <div className="bg-[#4B89EF] text-white py-1 px-3 rounded-full text-xs font-semibold shadow-lg">
              ✓ Voted
            </div>
          </div>
        )}

        {/* Thumbnail */}
        <Link href={`/projects/public/${project.id}`} className="block">
          <div className="relative w-full aspect-[16/9] md:aspect-[4/3] bg-slate-100">
            <CoverImageWithFallback
              src={project.cover_image_url}
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
        </Link>

        {/* Content */}
        <div className="py-4 px-6 flex-1 flex flex-col">
          {/* Project name */}
          <Link href={`/projects/public/${project.id}`}>
            <h3 className="font-bold text-black flex-1 min-w-0 text-[1.375rem] leading-[1.4] tracking-[-0.06em] truncate hover:text-[#4B89EF] transition-colors">
              {project.project_name || "Project"}
            </h3>
          </Link>

          {/* Description */}
          {project.project_description && (
            <p className="text-gray-800 text-sm leading-relaxed mb-4 line-clamp-2 mt-2">
              {project.project_description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="truncate max-w-[150px]">{project.lead_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              <span>
                {project.created_at
                  ? new Date(project.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "N/A"}
              </span>
            </div>
          </div>

          {/* Vote Button - at the bottom */}
          <div className="mt-auto pt-2">
            <VoteButton
              hasVoted={hasVoted}
              toggleAction={toggleVoteAction}
              canVote={canVote}
              size="default"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
