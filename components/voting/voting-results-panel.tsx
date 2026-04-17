"use client";

import { useVotingResults, VotingResult } from "@/features/voting/hooks/use-voting-results";
import { Loader, Trophy, Users, Vote, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { CoverImageWithFallback } from "@/features/projects/components/displays/cover-image-with-fallback";

interface VotingResultsPanelProps {
  eventId: string;
}

export function VotingResultsPanel({ eventId }: VotingResultsPanelProps) {
  const { results, totalVotes, totalVoters, isLoading, error, refresh } =
    useVotingResults(eventId);

  const exportToCSV = () => {
    const headers = ["Rank", "Project Name", "Lead Name", "Vote Count"];
    const rows = results.map((result, index) => [
      index + 1,
      result.projectName,
      result.leadName,
      result.voteCount,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `voting-results-${eventId}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-12 w-12 animate-spin text-[#4B89EF]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  const maxVotes = results.length > 0 ? results[0].voteCount : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
            Voting Results
          </h2>
          <p className="text-black/70 mt-1">
            Real-time voting results for this event
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-[rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#eaf2ff] rounded-lg">
              <Vote className="w-5 h-5 text-[#4B89EF]" />
            </div>
            <div>
              <p className="text-sm text-black/60">Total Votes</p>
              <p className="text-2xl font-bold text-black">{totalVotes}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-[rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#eef6ff] rounded-lg">
              <Users className="w-5 h-5 text-[#356fce]" />
            </div>
            <div>
              <p className="text-sm text-black/60">Total Voters</p>
              <p className="text-2xl font-bold text-black">{totalVoters}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-[rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-black/60">Projects Voted</p>
              <p className="text-2xl font-bold text-black">{results.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Results List */}
      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result, index) => (
            <ResultRow
              key={result.projectId}
              result={result}
              rank={index + 1}
              maxVotes={maxVotes}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-[rgba(0,0,0,0.15)] rounded-[20px]">
          <Vote className="w-12 h-12 text-black/30 mb-4" />
          <h3 className="text-lg font-semibold text-black/75">No votes yet</h3>
          <p className="text-black/55 mt-1">
            Votes will appear here as participants vote for projects.
          </p>
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result,
  rank,
  maxVotes,
}: {
  result: VotingResult;
  rank: number;
  maxVotes: number;
}) {
  const percentage = maxVotes > 0 ? (result.voteCount / maxVotes) * 100 : 0;

  return (
    <Card className="p-4 border-[rgba(0,0,0,0.15)] hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        {/* Rank Badge */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
            rank === 1
              ? "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400"
              : rank === 2
              ? "bg-gray-100 text-gray-700 ring-2 ring-gray-300"
              : rank === 3
              ? "bg-orange-100 text-orange-700 ring-2 ring-orange-300"
              : "bg-gray-50 text-gray-600"
          }`}
        >
          {rank <= 3 ? (
            <Trophy className="w-5 h-5" />
          ) : (
            `#${rank}`
          )}
        </div>

        {/* Project Image */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
          <CoverImageWithFallback
            src={result.coverImageUrl}
            alt={result.projectName}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/projects/public/${result.projectId}`}
            className="font-semibold text-black hover:text-[#4B89EF] transition-colors truncate block"
          >
            {result.projectName}
          </Link>
          <p className="text-sm text-gray-500 truncate">by {result.leadName}</p>
        </div>

        {/* Vote Bar */}
        <div className="hidden sm:block flex-1 max-w-[200px]">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4B89EF] rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Vote Count */}
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900">{result.voteCount}</p>
          <p className="text-xs text-gray-500">votes</p>
        </div>
      </div>
    </Card>
  );
}
