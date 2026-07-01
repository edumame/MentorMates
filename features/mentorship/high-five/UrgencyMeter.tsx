"use client";

import { getWaveUrgency, getUrgencyLabel, URGENCY_THRESHOLDS } from "./urgency";
import { cn } from "@/lib/utils";

interface UrgencyMeterProps {
  waitSeconds: number;
  className?: string;
}

const MAX_DISPLAY = URGENCY_THRESHOLDS.desperate + 30;

export function UrgencyMeter({ waitSeconds, className }: UrgencyMeterProps) {
  const urgency = getWaveUrgency(waitSeconds);
  const pct = Math.min(100, (waitSeconds / MAX_DISPLAY) * 100);

  return (
    <div className={cn("w-full max-w-xs space-y-1.5", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Urgency</span>
        <span
          className={cn(
            "font-medium",
            urgency === "desperate" && "text-orange-600",
            urgency === "frantic" && "text-amber-600",
            urgency === "eager" && "text-blue-600",
            urgency === "calm" && "text-gray-500"
          )}
        >
          {getUrgencyLabel(urgency)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            urgency === "desperate" && "bg-gradient-to-r from-orange-400 to-red-500",
            urgency === "frantic" && "bg-gradient-to-r from-amber-300 to-orange-400",
            urgency === "eager" && "bg-gradient-to-r from-blue-300 to-blue-500",
            urgency === "calm" && "bg-gradient-to-r from-gray-200 to-blue-300"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
