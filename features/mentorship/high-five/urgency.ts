import type { WaveUrgency } from "./types";

/** Seconds waiting before each urgency tier kicks in. */
export const URGENCY_THRESHOLDS = {
  eager: 15,
  frantic: 45,
  desperate: 90,
} as const;

export function getWaveUrgency(waitSeconds: number): WaveUrgency {
  if (waitSeconds < URGENCY_THRESHOLDS.eager) return "calm";
  if (waitSeconds < URGENCY_THRESHOLDS.frantic) return "eager";
  if (waitSeconds < URGENCY_THRESHOLDS.desperate) return "frantic";
  return "desperate";
}

export function getUrgencyLabel(urgency: WaveUrgency): string {
  switch (urgency) {
    case "calm":
      return "Just raised";
    case "eager":
      return "Waiting…";
    case "frantic":
      return "Getting antsy";
    case "desperate":
      return "Helloooo??";
  }
}
