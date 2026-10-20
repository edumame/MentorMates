"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { WavingHand } from "./WavingHand";
import { getUrgencyLabel, getWaveUrgency } from "./urgency";
import type { HelpRequest } from "./types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface HandWallProps {
  requests: HelpRequest[];
  onClaim: (requestId: string) => void;
  claimingId?: string | null;
  highlightedId?: string;
  waitOffset?: number;
  className?: string;
}

function useWaitSeconds(raisedAt: Date, offset = 0): number {
  const [seconds, setSeconds] = useState(() =>
    Math.floor((Date.now() - raisedAt.getTime()) / 1000) + offset
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - raisedAt.getTime()) / 1000) + offset);
    }, 1000);
    return () => clearInterval(id);
  }, [raisedAt, offset]);

  return seconds;
}

function HandCard({
  request,
  onClaim,
  claiming,
  isHighlighted,
  waitOffset = 0,
}: {
  request: HelpRequest;
  onClaim: () => void;
  claiming: boolean;
  isHighlighted?: boolean;
  waitOffset?: number;
}) {
  const waitSeconds = useWaitSeconds(request.raisedAt, waitOffset);
  const urgency = getWaveUrgency(waitSeconds);

  return (
    <motion.button
      type="button"
      onClick={onClaim}
      disabled={claiming}
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "group relative flex flex-col items-center rounded-2xl border-2 bg-white p-4 shadow-sm transition-colors",
        "hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        urgency === "desperate" && "border-orange-300 bg-orange-50/60",
        urgency === "frantic" && "border-amber-200 bg-amber-50/30",
        isHighlighted && "ring-2 ring-blue-500 ring-offset-2 border-blue-400",
        claiming && "opacity-60 pointer-events-none"
      )}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      {urgency === "desperate" && (
        <motion.span
          className="absolute -inset-0.5 rounded-2xl border-2 border-orange-400/50 pointer-events-none"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          aria-hidden
        />
      )}

      {isHighlighted && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          You
        </span>
      )}

      <WavingHand waitSeconds={waitSeconds} size="sm" />
      <p className="mt-2 text-sm font-bold text-gray-900 truncate max-w-full">
        {request.teamName}
      </p>
      {request.projectName && (
        <p className="text-xs text-gray-500 truncate max-w-full">
          {request.projectName}
        </p>
      )}
      <span
        className={cn(
          "mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tabular-nums",
          urgency === "desperate" && "bg-orange-100 text-orange-700",
          urgency === "frantic" && "bg-amber-100 text-amber-700",
          urgency === "eager" && "bg-blue-100 text-blue-700",
          urgency === "calm" && "bg-gray-100 text-gray-600"
        )}
      >
        {getUrgencyLabel(urgency)} · {waitSeconds}s
      </span>
      <span className="mt-2 text-[11px] font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
        High-five to claim →
      </span>
    </motion.button>
  );
}

export function HandWall({
  requests,
  onClaim,
  claimingId,
  highlightedId = "you",
  waitOffset = 0,
  className,
}: HandWallProps) {
  const waiting = useMemo(() => {
    return requests
      .filter((r) => r.status === "waiting")
      .sort((a, b) => a.raisedAt.getTime() - b.raisedAt.getTime());
  }, [requests]);

  if (waiting.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 p-10 text-center",
          className
        )}
      >
        <motion.span
          className="text-5xl mb-4 block"
          animate={{ rotate: [0, 14, -8, 14, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          ✋
        </motion.span>
        <p className="text-gray-700 font-semibold">No hands raised right now</p>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Switch to Participant view and slap the hand — you&apos;ll appear here
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {waiting.length} hand{waiting.length !== 1 ? "s" : ""} waving
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Longest waits look most frantic — tap to claim
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {waiting.map((req) => (
          <HandCard
            key={req.id}
            request={req}
            onClaim={() => onClaim(req.id)}
            claiming={claimingId === req.id}
            isHighlighted={req.id === highlightedId}
            waitOffset={req.id === highlightedId ? waitOffset : 0}
          />
        ))}
      </div>
    </div>
  );
}

const LEADERBOARD = [
  { name: "Alex K.", count: 47 },
  { name: "Jordan M.", count: 38 },
  { name: "Sam R.", count: 31 },
];

export function HighFiveStatsBadge({ count }: { count: number }) {
  return (
    <motion.div
      className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-3 text-white shadow-lg shadow-blue-200/50"
      key={count}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ duration: 0.35 }}
    >
      <span className="text-2xl" aria-hidden>
        🙌
      </span>
      <div>
        <p className="text-3xl font-black leading-none tabular-nums">{count}</p>
        <p className="text-xs font-medium text-blue-100">high-fives this weekend</p>
      </div>
    </motion.div>
  );
}

export function MiniLeaderboard({ currentCount }: { currentCount: number }) {
  type Row = { name: string; count: number; isYou?: boolean };

  const rows: Row[] = [
    { name: "You", count: currentCount, isYou: true },
    ...LEADERBOARD,
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm min-w-[180px]">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        Top mates
      </p>
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li
            key={row.name}
            className={cn(
              "flex items-center justify-between rounded-lg px-2 py-1.5 text-sm",
              row.isYou && "bg-blue-50 font-semibold text-blue-800"
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4">{i + 1}</span>
              {row.name}
            </span>
            <span className="tabular-nums text-gray-600">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SessionEndBarProps {
  participantDone: boolean;
  mentorDone: boolean;
  onParticipantDone: () => void;
  onMentorDone: () => void;
  role: "participant" | "mentor";
}

export function SessionEndBar({
  participantDone,
  mentorDone,
  onParticipantDone,
  onMentorDone,
  role,
}: SessionEndBarProps) {
  const myDone = role === "participant" ? participantDone : mentorDone;
  const theirDone = role === "participant" ? mentorDone : participantDone;
  const bothReady = participantDone && mentorDone;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-700 mb-4">
        Wrap up when you&apos;re done — both tap to fist-bump
      </p>

      <div className="flex gap-3 mb-4">
        <div
          className={cn(
            "flex-1 rounded-xl border-2 px-3 py-2.5 text-center text-xs font-medium transition-colors",
            participantDone
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-gray-100 bg-gray-50 text-gray-400"
          )}
        >
          {participantDone ? "✓ Participant ready" : "Participant…"}
        </div>
        <div
          className={cn(
            "flex-1 rounded-xl border-2 px-3 py-2.5 text-center text-xs font-medium transition-colors",
            mentorDone
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-gray-100 bg-gray-50 text-gray-400"
          )}
        >
          {mentorDone ? "✓ Mentor ready" : "Mentor…"}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant={myDone ? "secondary" : "default"}
          onClick={role === "participant" ? onParticipantDone : onMentorDone}
          disabled={myDone || bothReady}
          className="rounded-xl"
        >
          {myDone ? "✓ You're done" : "I'm done"}
        </Button>
        <span className="text-sm text-gray-500">
          {bothReady
            ? "Fist-bump incoming…"
            : theirDone
              ? "Partner is ready ✓"
              : "Waiting for partner…"}
        </span>
      </div>
    </div>
  );
}
