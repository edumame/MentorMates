"use client";

import { motion } from "framer-motion";

interface ImpactFlashProps {
  active: boolean;
}

export function ImpactFlash({ active }: ImpactFlashProps) {
  if (!active) return null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 bg-white"
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      aria-hidden
    />
  );
}

/** Comic-style impact lines radiating from center */
export function ImpactLines({ active }: { active: boolean }) {
  if (!active) return null;

  const lines = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {lines.map((deg) => (
        <motion.div
          key={deg}
          className="absolute h-1 w-12 sm:w-16 origin-center rounded-full bg-yellow-400"
          style={{ rotate: `${deg}deg` }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1.2, 0.8], opacity: [0, 1, 0] }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
