"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RaiseHandPanel } from "./RaiseHandPanel";
import {
  HandWall,
  HighFiveStatsBadge,
  MiniLeaderboard,
  SessionEndBar,
} from "./HandWall";
import { HighFiveConnect } from "./HighFiveConnect";
import { FistBumpMoment } from "./FistBumpMoment";
import { DemoPhaseStepper, phaseToStep } from "./DemoPhaseStepper";
import type { HelpRequest } from "./types";

type DemoPhase =
  | "idle"
  | "participant_waiting"
  | "high_five"
  | "in_session"
  | "fist_bump"
  | "feedback";

/** Pre-set wait times so the wall shows all urgency tiers immediately */
const MOCK_TEAMS: Omit<HelpRequest, "raisedAt" | "status">[] = [
  { id: "mock-1", teamName: "Null Pointers", projectName: "Queue Vision" },
  { id: "mock-2", teamName: "Debug Ducks", projectName: "HackMap" },
  { id: "mock-3", teamName: "Byte Buddies", projectName: "AI Study Pal" },
];

const MOCK_WAIT_SECONDS = [96, 52, 18];

function makeMockRequests(
  participantWaiting: boolean,
  participantRaisedAt: Date | null,
  waitOffset: number
): HelpRequest[] {
  const now = Date.now();
  const mocks: HelpRequest[] = MOCK_TEAMS.map((t, i) => ({
    ...t,
    raisedAt: new Date(now - (MOCK_WAIT_SECONDS[i] + waitOffset) * 1000),
    status: "waiting" as const,
  }));

  if (participantWaiting && participantRaisedAt) {
    mocks.unshift({
      id: "you",
      teamName: "Your Team",
      projectName: "My Hackathon Project",
      raisedAt: new Date(participantRaisedAt.getTime() - waitOffset * 1000),
      status: "waiting",
    });
  }

  return mocks;
}

function FeedbackStub({ onReset }: { onReset: () => void }) {
  return (
    <motion.div
      className="rounded-3xl border border-gray-200 bg-white p-8 text-center space-y-5 shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-4xl" aria-hidden>
        ⭐
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">Session complete!</p>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          In the real app, a quick feedback form opens here — powered by the fist-bump, not a random toast.
        </p>
      </div>
      <div className="mx-auto max-w-sm rounded-xl bg-gray-50 border border-gray-100 p-4 text-left space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Preview
        </p>
        <div className="h-2 rounded bg-gray-200 w-full" />
        <div className="h-2 rounded bg-gray-200 w-4/5" />
        <div className="h-16 rounded bg-gray-200 w-full" />
      </div>
      <Button onClick={onReset} size="lg" className="rounded-xl px-8">
        Try the loop again
      </Button>
    </motion.div>
  );
}

export function HighFiveDemo() {
  const [role, setRole] = useState<"participant" | "mentor">("participant");
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [raisedAt, setRaisedAt] = useState<Date | null>(null);
  const [waitOffset, setWaitOffset] = useState(0);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [connectedTeam, setConnectedTeam] = useState<string | null>(null);
  const [participantDone, setParticipantDone] = useState(false);
  const [mentorDone, setMentorDone] = useState(false);
  const [highFiveCount, setHighFiveCount] = useState(47);
  const [showMentorHint, setShowMentorHint] = useState(false);

  const isWaiting = phase === "participant_waiting";
  const requests = useMemo(
    () => makeMockRequests(isWaiting, raisedAt, waitOffset),
    [isWaiting, raisedAt, waitOffset]
  );

  const handleRaise = useCallback(() => {
    setRaisedAt(new Date());
    setPhase("participant_waiting");
    setShowMentorHint(true);
    setTimeout(() => setShowMentorHint(false), 5000);
  }, []);

  const handleCancel = useCallback(() => {
    setRaisedAt(null);
    setWaitOffset(0);
    setPhase("idle");
  }, []);

  const handleFastForward = useCallback(() => {
    setWaitOffset((o) => o + 30);
  }, []);

  const handleClaim = useCallback(
    (requestId: string) => {
      const req = requests.find((r) => r.id === requestId);
      if (!req) return;
      setClaimingId(requestId);
      setConnectedTeam(req.teamName);
      setPhase("high_five");
    },
    [requests]
  );

  const handleHighFiveComplete = useCallback(() => {
    setClaimingId(null);
    setPhase("in_session");
    setHighFiveCount((c) => c + 1);
  }, []);

  const handleFistBumpComplete = useCallback(() => {
    setPhase("feedback");
  }, []);

  const handleReset = useCallback(() => {
    setPhase("idle");
    setRaisedAt(null);
    setWaitOffset(0);
    setConnectedTeam(null);
    setParticipantDone(false);
    setMentorDone(false);
    setClaimingId(null);
    setRole("participant");
  }, []);

  useEffect(() => {
    if (phase === "in_session" && participantDone && mentorDone) {
      const t = setTimeout(() => setPhase("fist_bump"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, participantDone, mentorDone]);

  const activeStep = phaseToStep(phase);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wider">
          Interactive prototype
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
          The High-Five
        </h1>
        <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
          MentorMates&apos; signature moment — connection as a feeling, not a notification.
        </p>
      </div>

      <DemoPhaseStepper activeStep={activeStep} />

      {/* Role tabs */}
      <Tabs
        value={role}
        onValueChange={(v) => setRole(v as "participant" | "mentor")}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-sm mx-auto grid-cols-2 h-11 rounded-xl">
          <TabsTrigger value="participant" className="rounded-lg font-semibold">
            ✋ Participant
          </TabsTrigger>
          <TabsTrigger value="mentor" className="rounded-lg font-semibold">
            🙌 Mentor
          </TabsTrigger>
        </TabsList>

        <AnimatePresence>
          {showMentorHint && phase === "participant_waiting" && (
            <motion.p
              className="mt-4 text-center text-sm font-medium text-blue-600"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Hand is live → switch to Mentor tab to high-five it
            </motion.p>
          )}
        </AnimatePresence>

        <TabsContent value="participant" className="mt-6">
          {phase === "idle" || phase === "participant_waiting" ? (
            <RaiseHandPanel
              isWaiting={phase === "participant_waiting"}
              raisedAt={raisedAt}
              waitOffset={waitOffset}
              onRaise={handleRaise}
              onCancel={handleCancel}
              onFastForward={handleFastForward}
            />
          ) : phase === "high_five" ? (
            <HighFiveConnect
              teamName={connectedTeam ?? "Your Team"}
              mentorName="Alex (Mentor)"
              onComplete={handleHighFiveComplete}
            />
          ) : phase === "in_session" ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-green-200 bg-gradient-to-b from-green-50 to-white p-8 text-center">
                <p className="text-4xl mb-3" aria-hidden>
                  🙌
                </p>
                <p className="text-xl font-bold text-green-800">
                  Connected with Alex!
                </p>
                <p className="text-sm text-green-700 mt-2">
                  Work through your blocker, then both tap done.
                </p>
              </div>
              <SessionEndBar
                role="participant"
                participantDone={participantDone}
                mentorDone={mentorDone}
                onParticipantDone={() => setParticipantDone(true)}
                onMentorDone={() => setMentorDone(true)}
              />
              {!mentorDone && (
                <p className="text-xs text-center text-gray-400">
                  Switch to Mentor tab and tap &quot;I&apos;m done&quot; too
                </p>
              )}
            </div>
          ) : phase === "fist_bump" ? (
            <FistBumpMoment onComplete={handleFistBumpComplete} />
          ) : (
            <FeedbackStub onReset={handleReset} />
          )}
        </TabsContent>

        <TabsContent value="mentor" className="mt-6 space-y-5">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between">
            <HighFiveStatsBadge count={highFiveCount} />
            <MiniLeaderboard currentCount={highFiveCount} />
          </div>

          {phase === "high_five" ? (
            <HighFiveConnect
              teamName={connectedTeam ?? "A team"}
              mentorName="You"
              onComplete={handleHighFiveComplete}
            />
          ) : phase === "in_session" ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-green-200 bg-green-50 p-6 text-center">
                <p className="font-bold text-green-800 text-lg">
                  In session with {connectedTeam}
                </p>
              </div>
              <SessionEndBar
                role="mentor"
                participantDone={participantDone}
                mentorDone={mentorDone}
                onParticipantDone={() => setParticipantDone(true)}
                onMentorDone={() => setMentorDone(true)}
              />
            </div>
          ) : phase === "fist_bump" ? (
            <FistBumpMoment onComplete={handleFistBumpComplete} />
          ) : phase === "feedback" ? (
            <FeedbackStub onReset={handleReset} />
          ) : (
            <HandWall
              requests={requests}
              onClaim={handleClaim}
              claimingId={claimingId}
              highlightedId="you"
              waitOffset={waitOffset}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <div className="rounded-2xl bg-gray-900 text-gray-300 p-5 sm:p-6 text-sm space-y-3">
        <p className="font-semibold text-white text-base">Try the full loop</p>
        <ol className="space-y-2 list-none">
          {[
            "Participant → slap the hand (watch the SLAP ripple)",
            "Mentor → tap your card (or any team) for the SMACK",
            "Both → tap I'm done for the fist-bump + feedback",
            "Use ⏩ +30s to see the wave go frantic without waiting",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        {(phase !== "idle" && phase !== "feedback") && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="mt-2 rounded-lg border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Reset demo
          </Button>
        )}
      </div>
    </div>
  );
}
