"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { CartoonHand } from "./CartoonHand";
import { WavingHand } from "./WavingHand";
import { UrgencyMeter } from "./UrgencyMeter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClapSound } from "./use-clap-sound";

interface RaiseHandPanelProps {
  isWaiting: boolean;
  raisedAt: Date | null;
  waitOffset?: number;
  onRaise: () => void;
  onCancel?: () => void;
  onFastForward?: () => void;
  teamName?: string;
  className?: string;
}

function useWaitSeconds(raisedAt: Date | null, offset = 0): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!raisedAt) {
      setSeconds(0);
      return;
    }
    const tick = () =>
      setSeconds(Math.floor((Date.now() - raisedAt.getTime()) / 1000) + offset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [raisedAt, offset]);

  return seconds;
}

function SlapRipple() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-3xl border-2 border-blue-400"
          initial={{ scale: 0.8, opacity: 0.7 }}
          animate={{ scale: 1.6 + i * 0.3, opacity: 0 }}
          transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
          aria-hidden
        />
      ))}
    </>
  );
}

export function RaiseHandPanel({
  isWaiting,
  raisedAt,
  waitOffset = 0,
  onRaise,
  onCancel,
  onFastForward,
  teamName = "Your team",
  className,
}: RaiseHandPanelProps) {
  const waitSeconds = useWaitSeconds(raisedAt, waitOffset);
  const { playClap } = useClapSound();
  const [isSlapping, setIsSlapping] = useState(false);

  const handleSlap = () => {
    setIsSlapping(true);
    playClap();
    setTimeout(() => {
      onRaise();
      setIsSlapping(false);
    }, 380);
  };

  if (!isWaiting) {
    return (
      <div
        className={cn(
          "relative flex flex-col items-center overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-b from-white via-blue-50/30 to-blue-100/40 p-8 sm:p-10 text-center shadow-sm",
          className
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(66,134,244,0.12),transparent_60%)] pointer-events-none" />

        <p className="relative text-xl font-bold text-gray-900 mb-1">Stuck?</p>
        <p className="relative text-sm text-gray-500 mb-8 max-w-sm leading-relaxed">
          Slap the hand — it springs up and waves until a mentor high-fives you back.
        </p>

        <div className="relative">
          <AnimatePresence>{isSlapping && <SlapRipple />}</AnimatePresence>

          <motion.button
            type="button"
            onClick={handleSlap}
            disabled={isSlapping}
            className="group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-3xl"
            whileHover={!isSlapping ? { scale: 1.03 } : undefined}
            animate={
              isSlapping
                ? { scale: [1, 0.88, 1.08], rotate: [0, -4, 0] }
                : { scale: 1 }
            }
            transition={{ duration: 0.35, ease: "easeOut" }}
            aria-label="Raise hand for mentor help"
          >
            <motion.div
              className="rounded-3xl bg-white/80 p-6 sm:p-8 ring-4 ring-blue-200/70 shadow-lg shadow-blue-100/80 group-hover:ring-blue-300 group-hover:shadow-blue-200/60 transition-shadow"
              animate={isSlapping ? { y: [0, 8, -16, 0] } : { y: [0, -5, 0] }}
              transition={
                isSlapping
                  ? { duration: 0.35 }
                  : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <CartoonHand className="h-36 w-32 sm:h-44 sm:w-40" />
            </motion.div>

            <motion.p
              className="mt-5 text-sm font-bold text-blue-700 uppercase tracking-widest"
              animate={{ opacity: isSlapping ? 0 : 1 }}
            >
              Slap to raise hand
            </motion.p>
          </motion.button>

          <AnimatePresence>
            {isSlapping && (
              <motion.p
                className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg font-black text-blue-600 whitespace-nowrap"
                initial={{ opacity: 0, y: 10, scale: 0.5 }}
                animate={{ opacity: 1, y: -20, scale: 1.1 }}
                exit={{ opacity: 0 }}
              >
                SLAP!
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-3xl border-2 border-blue-300/60 bg-gradient-to-b from-blue-50 to-white p-8 sm:p-10 text-center shadow-inner shadow-blue-100/50",
        className
      )}
    >
      <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Live on the wall
      </div>

      <p className="text-sm font-medium text-blue-800 mt-3 mb-0.5">{teamName}</p>
      <p className="text-lg font-bold text-gray-900 mb-6">
        Hand raised — mentors can see you!
      </p>

      <WavingHand waitSeconds={waitSeconds} size="lg" />

      <p className="mt-6 text-sm tabular-nums text-gray-500">
        Waiting <span className="font-semibold text-gray-700">{waitSeconds}s</span>
        {" · "}wave gets more frantic over time
      </p>

      <UrgencyMeter waitSeconds={waitSeconds} className="mt-4" />

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {onFastForward && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={onFastForward}
          >
            ⏩ +30s (demo)
          </Button>
        )}
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-gray-500"
            onClick={onCancel}
          >
            Lower hand
          </Button>
        )}
      </div>
    </div>
  );
}
