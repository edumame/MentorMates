"use client";

import { useEffect, useState } from "react";
import { Loader, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { VotableProjectCard } from "./votable-project-card";
import { VoteCounter } from "./vote-counter";
import { useEventVotes } from "@/features/voting/hooks/use-event-votes";
import { Project } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EventSearchInput } from "@/components/ui/event-search-input";

interface VotingContentProps {
  eventId: string;
  slug: string;
  hasJoined: boolean;
  userRole?: string | null;
}

export function VotingContent({
  eventId,
  slug,
  hasJoined,
  userRole,
}: VotingContentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    voteCounts,
    remainingVotes,
    maxVotes,
    isLoading: isLoadingVotes,
    error: voteError,
    hasVoted,
    getVoteCount,
    toggleVote,
  } = useEventVotes(eventId);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const response = await fetch(
          `/api/projects?eventId=${eventId}&public=true`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error("Error fetching projects:", error);
        setProjects([]);
      }
      setIsLoadingProjects(false);
    };

    fetchProjects();
  }, [eventId]);

  const filteredProjects = projects.filter(
    (project) =>
      project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      project.lead_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort projects: user's voted projects first, then by vote count
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const aVoted = hasVoted(a.id) ? 1 : 0;
    const bVoted = hasVoted(b.id) ? 1 : 0;
    if (aVoted !== bVoted) return bVoted - aVoted;
    return getVoteCount(b.id) - getVoteCount(a.id);
  });

  const isLoading = isLoadingProjects || isLoadingVotes;
  const canVote = hasJoined && remainingVotes > 0;

  return (
    <div className="flex flex-col flex-1 w-full">
      {/* Header with Vote Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vote for Projects</h2>
          <p className="text-gray-600 mt-1">
            Choose your favorite {maxVotes} projects to vote for
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Individual vote totals stay hidden until organizers publish results.
          </p>
        </div>
        {hasJoined && (
          <VoteCounter
            remainingVotes={remainingVotes}
            maxVotes={maxVotes}
            className="bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm"
          />
        )}
      </div>

      {/* Error Alert */}
      {voteError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{voteError}</AlertDescription>
        </Alert>
      )}

      {/* Not Joined Warning */}
      {!hasJoined && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Join this event to vote for projects. You can still browse projects below.
          </AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <EventSearchInput
        wrapperClassName="mb-6 w-full max-w-[560px]"
        placeholder="Search projects by name, description, or lead"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        inputClassName="text-[16px] leading-[1.5] sm:text-[16px]"
      />

      {/* Project Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="h-12 w-12 animate-spin text-purple-400" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full"
        >
          {sortedProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProjects.map((project) => (
                <VotableProjectCard
                  key={project.id}
                  project={project}
                  hasVoted={hasVoted(project.id)}
                  toggleVoteAction={() => toggleVote(project.id)}
                  canVote={canVote}
                  eventSlug={slug}
                />
              ))}
            </div>
          ) : (
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
                  />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700">
                  No projects to vote on yet
                </h3>
                <p className="text-gray-500 max-w-sm">
                  Projects will appear here once they are submitted to the event.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
