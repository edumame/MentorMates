"use client";

import { motion } from "framer-motion";
import { CartoonHand } from "./CartoonHand";
import { getWaveUrgency } from "./urgency";
import type { WaveUrgency } from "./types";
import { cn } from "@/lib/utils";

interface WavingHandProps {
  waitSeconds: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showSweat?: boolean;
}

const SIZE_MAP = {
  sm: "w-16 h-20",
  md: "w-24 h-28",
  lg: "w-36 h-44",
};

function waveAnimation(urgency: WaveUrgency) {
  switch (urgency) {
    case "calm":
      return {
        rotate: [0, 18, -8, 14, 0],
        transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "eager":
      return {
        rotate: [0, 28, -14, 24, -10, 20, 0],
        transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "frantic":
      return {
        rotate: [0, 35, -22, 30, -18, 28, -12, 25, 0],
        y: [0, -4, 0, -6, 0],
        transition: { duration: 0.65, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "desperate":
      return {
        rotate: [0, 40, -30, 35, -25, 32, 0],
        y: [0, -8, 2, -10, 0],
        x: [0, 3, -3, 4, -4, 0],
        transition: { duration: 0.45, repeat: Infinity, ease: "easeInOut" as const },
      };
  }
}

function SweatDrop({ delay, x }: { delay: number; x: number }) {
  return (
    <motion.div
      className="absolute text-blue-400 text-lg font-bold select-none pointer-events-none"
      style={{ left: `${x}%`, top: "8%" }}
      animate={{ y: [0, 12, 0], opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
      transition={{ duration: 0.9, repeat: Infinity, delay, ease: "easeInOut" }}
      aria-hidden
    >
      💧
    </motion.div>
  );
}

export function WavingHand({
  waitSeconds,
  size = "md",
  className,
  showSweat = true,
}: WavingHandProps) {
  const urgency = getWaveUrgency(waitSeconds);
  const pose = urgency === "desperate" ? "jazz" : "wave";
  const anim = waveAnimation(urgency);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {showSweat && (urgency === "frantic" || urgency === "desperate") && (
        <>
          <SweatDrop delay={0} x={72} />
          <SweatDrop delay={0.35} x={18} />
          {urgency === "desperate" && <SweatDrop delay={0.7} x={48} />}
        </>
      )}

      {urgency === "desperate" && (
        <motion.span
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-orange-500 whitespace-nowrap"
          animate={{ opacity: [0.6, 1, 0.6], y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          helloooo??
        </motion.span>
      )}

      <motion.div
        className="origin-bottom"
        animate={anim}
        style={{ transformOrigin: "50% 90%" }}
      >
        <CartoonHand pose={pose} className={SIZE_MAP[size]} />
      </motion.div>
    </div>
  );
}
