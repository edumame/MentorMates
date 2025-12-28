"use client";

import { Vote } from "lucide-react";

interface VoteCounterProps {
  remainingVotes: number;
  maxVotes: number;
  className?: string;
}

export function VoteCounter({ remainingVotes, maxVotes, className = "" }: VoteCounterProps) {
  const usedVotes = maxVotes - remainingVotes;
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Vote className="w-5 h-5 text-purple-600" />
      <span className="text-sm font-medium text-gray-700">
        {remainingVotes} of {maxVotes} votes remaining
      </span>
      <div className="flex gap-1 ml-2">
        {Array.from({ length: maxVotes }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i < usedVotes
                ? "bg-purple-600"
                : "bg-gray-200 border border-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
