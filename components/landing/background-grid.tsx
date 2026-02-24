"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface BackgroundGridProps {
  children?: ReactNode;
  className?: string;
  /**
   * Grid line color at rest (Tailwind color with opacity).
   * Default is a subtle slate tint.
   */
  lineColorClassName?: string;
}

export function BackgroundGrid({
  children,
  className,
  lineColorClassName = "text-slate-200/70",
}: BackgroundGridProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Grid */}
      <motion.div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0", lineColorClassName)}
        animate={{
          backgroundPosition: ["0px 0px", "80px 80px"],
        }}
        transition={{
          duration: 18,
          ease: "linear",
          repeat: Infinity,
        }}
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          // Aceternity-style vignette mask so grid fades out.
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 35%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
          maskImage:
            "radial-gradient(ellipse at 50% 35%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* Soft glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 50% 30%, rgba(59,130,246,0.10), transparent 55%)",
        }}
      />

      <div className="relative">{children}</div>
    </div>
  );
}

