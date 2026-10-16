"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect, useState } from "react";
import { CartoonHand } from "./CartoonHand";
import { SparkBurst } from "./SparkBurst";
import { ImpactFlash, ImpactLines } from "./ImpactFlash";
import { useClapSound } from "./use-clap-sound";

interface HighFiveConnectProps {
  teamName: string;
  mentorName?: string;
  onComplete: () => void;
}

export function HighFiveConnect({
  teamName,
  mentorName = "Your mentor",
  onComplete,
}: HighFiveConnectProps) {
  const controls = useAnimation();
  const participantControls = useAnimation();
  const { playHighFive } = useClapSound();
  const [phase, setPhase] = useState<"fly" | "smack" | "done">("fly");
  const [showSparks, setShowSparks] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      await Promise.all([
        controls.start({
          x: [220, -8],
          transition: { type: "spring", stiffness: 420, damping: 22 },
        }),
        participantControls.start({
          x: [0, 8],
          transition: { type: "spring", stiffness: 420, damping: 22, delay: 0.05 },
        }),
      ]);

      if (cancelled) return;
      setPhase("smack");
      setShowSparks(true);
      setShowFlash(true);
      playHighFive();

      await controls.start({
        x: [-8, -4, 4, -2, 2, 0],
        transition: { duration: 0.28 },
      });

      if (cancelled) return;
      setPhase("done");
      completionTimer = setTimeout(onComplete, 1100);
    };
    void run();
    return () => {
      cancelled = true;
      clearTimeout(completionTimer);
      controls.stop();
      participantControls.stop();
    };
  }, [controls, participantControls, onComplete, playHighFive]);

  return (
    <div
      className="relative flex min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-blue-100/80 via-blue-50 to-white px-6 py-12 shadow-inner"
      role="status"
      aria-live="polite"
      aria-label={`High-five! ${mentorName} connected with ${teamName}`}
    >
      <ImpactFlash active={showFlash} />

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={
          phase === "smack"
            ? { x: [0, -10, 10, -6, 6, 0], scale: [1, 1.02, 1] }
            : {}
        }
        transition={{ duration: 0.32 }}
      >
        <div className="relative flex items-end justify-center">
          <motion.div animate={participantControls}>
            <CartoonHand className="h-40 w-36 sm:h-44 sm:w-40" skinTone="warm" />
          </motion.div>

          <motion.div animate={controls} initial={{ x: 220 }} className="-ml-4">
            <CartoonHand className="h-40 w-36 sm:h-44 sm:w-40" skinTone="cool" flip />
          </motion.div>
        </div>
      </motion.div>

      <ImpactLines active={phase === "smack"} />
      <SparkBurst active={showSparks} />

      {phase === "smack" && (
        <motion.p
          className="absolute bottom-16 text-center text-3xl sm:text-4xl font-black tracking-tight text-blue-700 drop-shadow-sm"
          initial={{ scale: 0, opacity: 0, rotate: -8 }}
          animate={{ scale: [0, 1.35, 1], opacity: 1, rotate: [-8, 4, 0] }}
          transition={{ type: "spring", stiffness: 500, damping: 14 }}
        >
          SMACK!
        </motion.p>
      )}

      {phase === "done" && (
        <motion.div
          className="absolute bottom-8 text-center px-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <p className="text-xl font-bold text-gray-900">
            {mentorName}{" "}
            <span className="text-blue-500 font-normal">×</span> {teamName}
          </p>
          <p className="text-sm text-gray-500 mt-1">Connected — go build!</p>
        </motion.div>
      )}
    </div>
  );
}
