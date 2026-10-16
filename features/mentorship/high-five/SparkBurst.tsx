"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

interface SparkBurstProps {
  active: boolean;
  onComplete?: () => void;
}

const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: (i / 12) * 360,
  distance: 40 + (i % 3) * 18,
  color: ["#FBBF24", "#F97316", "#4286F4", "#FDE68A"][i % 4],
}));

export function SparkBurst({ active, onComplete }: SparkBurstProps) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => onComplete?.(), 600);
    return () => clearTimeout(t);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {SPARKS.map((spark) => {
        const rad = (spark.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * spark.distance;
        const ty = Math.sin(rad) * spark.distance;
        return (
          <motion.span
            key={spark.id}
            className="absolute block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: spark.color }}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{ scale: [0, 1.4, 0], x: tx, y: ty, opacity: [1, 1, 0] }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        );
      })}
      <motion.span
        className="absolute text-4xl select-none"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.6, 1], opacity: [0, 1, 0] }}
        transition={{ duration: 0.45 }}
      >
        ✨
      </motion.span>
    </div>
  );
}
