"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CartoonHand } from "./CartoonHand";
import { SparkBurst } from "./SparkBurst";
import { ImpactFlash } from "./ImpactFlash";
import { useClapSound } from "./use-clap-sound";

interface FistBumpMomentProps {
  onComplete: () => void;
}

export function FistBumpMoment({ onComplete }: FistBumpMomentProps) {
  const { playHighFive } = useClapSound();
  const [bumped, setBumped] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const t = setTimeout(() => {
      setBumped(true);
      setShowFlash(true);
      playHighFive();
    }, 500);
    const done = setTimeout(onComplete, 2000);
    return () => {
      clearTimeout(t);
      clearTimeout(done);
    };
  }, [onComplete, playHighFive]);

  return (
    <div
      className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-amber-100/60 via-amber-50 to-white px-6 py-12"
      role="status"
      aria-live="polite"
      aria-label="Session complete — fist bump!"
    >
      <ImpactFlash active={showFlash} />

      <motion.div
        className="relative flex items-center justify-center"
        animate={bumped ? { x: [0, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          initial={{ x: -100, opacity: 0, rotate: -10 }}
          animate={{ x: bumped ? 14 : -24, opacity: 1, rotate: bumped ? 0 : -10 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
        >
          <CartoonHand pose="fist" className="h-32 w-28" skinTone="warm" />
        </motion.div>
        <motion.div
          initial={{ x: 100, opacity: 0, rotate: 10 }}
          animate={{ x: bumped ? -14 : 24, opacity: 1, rotate: bumped ? 0 : 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
        >
          <CartoonHand pose="fist" className="h-32 w-28" skinTone="cool" flip />
        </motion.div>
      </motion.div>

      <SparkBurst active={bumped} />

      {bumped && (
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          <p className="text-2xl font-black text-amber-700">BUMP!</p>
          <p className="mt-2 text-base font-medium text-gray-700">
            Nice session — time for feedback?
          </p>
        </motion.div>
      )}
    </div>
  );
}
