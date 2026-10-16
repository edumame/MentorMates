"use client";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: "raise", label: "Raise", emoji: "✋" },
  { id: "connect", label: "High-five", emoji: "🙌" },
  { id: "session", label: "Session", emoji: "💬" },
  { id: "close", label: "Fist-bump", emoji: "👊" },
  { id: "feedback", label: "Feedback", emoji: "⭐" },
] as const;

export type DemoStepId = (typeof STEPS)[number]["id"];

interface DemoPhaseStepperProps {
  activeStep: DemoStepId;
  className?: string;
}

export function DemoPhaseStepper({ activeStep, className }: DemoPhaseStepperProps) {
  const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-1.5 min-w-0">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors duration-300",
                      done || active ? "bg-blue-500" : "bg-gray-200"
                    )}
                  />
                )}
                <div
                  className={cn(
                    "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-sm transition-all duration-300",
                    active && "bg-blue-600 text-white shadow-md shadow-blue-200 scale-110",
                    done && !active && "bg-blue-100 text-blue-700",
                    !done && !active && "bg-gray-100 text-gray-400"
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done && !active ? "✓" : step.emoji}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors duration-300",
                      done ? "bg-blue-500" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-medium truncate max-w-full text-center",
                  active ? "text-blue-700" : done ? "text-blue-600/70" : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function phaseToStep(phase: string): DemoStepId {
  switch (phase) {
    case "idle":
    case "participant_waiting":
      return "raise";
    case "high_five":
      return "connect";
    case "in_session":
      return "session";
    case "fist_bump":
      return "close";
    case "feedback":
      return "feedback";
    default:
      return "raise";
  }
}
