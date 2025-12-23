"use client";

import { Button } from "@/components/ui/button";
import { Vote, Check, Loader2 } from "lucide-react";
import { useState } from "react";

interface VoteButtonProps {
  hasVoted: boolean;
  voteCount: number;
  onToggle: () => Promise<boolean>;
  disabled?: boolean;
  canVote?: boolean;
  size?: "sm" | "default" | "lg";
}

export function VoteButton({
  hasVoted,
  voteCount,
  onToggle,
  disabled = false,
  canVote = true,
  size = "default",
}: VoteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading || disabled) return;
    
    setIsLoading(true);
    try {
      await onToggle();
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = disabled || isLoading || (!hasVoted && !canVote);

  return (
    <Button
      variant={hasVoted ? "default" : "outline"}
      size={size}
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        transition-all duration-200
        ${hasVoted 
          ? "bg-purple-600 hover:bg-purple-700 text-white" 
          : "hover:border-purple-400 hover:text-purple-600"
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
      <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
        {voteCount}
      </span>
    </Button>
  );
}
