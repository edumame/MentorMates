"use client";

import { Button } from "@/components/ui/button";
import { Vote, Check, Loader2 } from "lucide-react";
import { useState } from "react";

interface VoteButtonProps {
  hasVoted: boolean;
  toggleAction: () => Promise<boolean>;
  voteCount?: number;
  disabled?: boolean;
  canVote?: boolean;
  size?: "sm" | "default" | "lg";
  showVoteCount?: boolean;
}

export function VoteButton({
  hasVoted,
  toggleAction,
  disabled = false,
  canVote = true,
  size = "default",
  voteCount,
  showVoteCount = false,
}: VoteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading || disabled || !canVote) return;
    
    setIsLoading(true);
    try {
      await toggleAction();
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = disabled || isLoading || !canVote;

  return (
    <Button
      variant={hasVoted ? "default" : "outline"}
      size={size}
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        transition-all duration-200
        ${hasVoted 
          ? "bg-[#4B89EF] hover:bg-[#3E7EEA] text-white border-[#4B89EF]" 
          : "border-[rgba(0,0,0,0.15)] hover:border-[#4B89EF] hover:text-[#4B89EF]"
        }
        ${isDisabled && !hasVoted ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : hasVoted ? (
        <Check className="w-4 h-4 mr-2" />
      ) : (
        <Vote className="w-4 h-4 mr-2" />
      )}
      <span>{hasVoted ? "Voted" : "Vote"}</span>
      {showVoteCount && typeof voteCount === "number" && (
        <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
          {voteCount}
        </span>
      )}
    </Button>
  );
}
