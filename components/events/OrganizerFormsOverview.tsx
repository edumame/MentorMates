"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type OrganizerFormView =
  | "application"
  | "submission"
  | "rsvp"
  | "post-survey";
const TOUR_KEY = "mentormates:organizer-forms-tour:v1";
const forms = [
  {
    id: "application",
    stage: "01 · Join the event",
    title: "Application form",
    purpose: "Collect applications from people who want to participate.",
    subject: "About the participant",
    examples: "Name, experience, and motivation to join",
  },
  {
    id: "submission",
    stage: "02 · Submit project work",
    title: "Submission form",
    purpose: "Collect projects and deliverables from event participants.",
    subject: "About the project",
    examples: "Project name, description, demo, and links",
  },
] as const;
const steps = [
  {
    target: "submission",
    title: "Looking for project submissions?",
    copy: "This is the form you need. Open Submission form to set the questions participants answer when they submit their project.",
  },
  {
    target: "application",
    title: "Applications are for joining",
    copy: "Use Application form to ask about the person applying to your event. Project descriptions, demos, and deliverables belong in Submission form.",
  },
] as const;

export function OrganizerFormsOverview({
  onSelect,
}: {
  onSelect: (view: OrganizerFormView) => void;
}) {
  const [step, setStep] = useState<number | null>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const tourRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // This is a browser-local tutorial preference, never an access-control flag.
    try {
      if (!localStorage.getItem(TOUR_KEY)) setStep(0);
    } catch {
      setStep(0);
    }
  }, []);

  const closeTour = () => {
    setStep(null);
    try {
      localStorage.setItem(TOUR_KEY, "seen");
    } catch {
      /* Storage may be disabled. */
    }
    replayRef.current?.focus();
  };

  const current = step === null ? null : steps[step];
  useEffect(() => {
    // The coachmark moves between cards; reveal the new step on narrow screens.
    if (step !== null) tourRef.current?.focus();
  }, [step]);
  return (
    <section
      aria-label="Event forms"
      className="w-full min-w-0 space-y-6 text-foreground"
      onKeyDown={(event) => {
        if (event.key === "Escape" && current) {
          event.preventDefault();
          closeTour();
        }
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Event forms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One form to join. One form to submit work.
          </p>
        </div>
        <Button
          ref={replayRef}
          variant="outline"
          className="gap-2"
          onClick={() => {
            setStep(0);
            // Wait for the tutorial to mount before moving keyboard focus.
            requestAnimationFrame(() => tourRef.current?.focus());
          }}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          Show me around
        </Button>
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
          {forms.map((form) => (
            <div key={form.id} className="min-w-0 space-y-5">
              <section
                aria-label={form.title}
                className={cn(
                  "rounded-xl border bg-card p-5 text-card-foreground",
                  current?.target === form.id &&
                    "ring-2 ring-blue-500 ring-offset-4 ring-offset-background",
                )}
              >
                <span className="inline-block rounded-md bg-blue-50 px-2 py-1 text-xs font-medium uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                  {form.stage}
                </span>
                <h3 className="mb-1 mt-4 text-lg font-semibold">
                  {form.title}
                </h3>
                <p className="min-h-10 text-sm text-muted-foreground">
                  {form.purpose}
                </p>
                <div className="my-4 border-t pt-4 text-sm">
                  <p className="font-medium">{form.subject}</p>
                  <p className="mt-1 text-muted-foreground">{form.examples}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={form.id === "submission" ? "default" : "outline"}
                      className="h-auto min-h-11 w-full gap-2 whitespace-normal px-3 py-2 text-sm"
                      onClick={() => {
                        closeTour();
                        onSelect(form.id);
                      }}
                    >
                      Manage {form.title.toLowerCase()}
                      <ArrowUpRight
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    {form.purpose}
                  </TooltipContent>
                </Tooltip>
              </section>
              {current?.target === form.id && (
                <section
                  ref={tourRef}
                  tabIndex={-1}
                  aria-label="Organizer quick tour"
                  className="relative rounded-xl border border-blue-400 bg-popover p-5 text-popover-foreground shadow-lg"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 left-8 h-3.5 w-3.5 rotate-45 border-l border-t border-blue-400 bg-popover"
                  />
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      Organizer quick tour · {(step ?? 0) + 1} of {steps.length}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label="Close tutorial"
                      onClick={closeTour}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div aria-live="polite">
                    <h3 className="text-lg font-semibold">{current.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {current.copy}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-1.5" aria-hidden="true">
                      {steps.map((_, index) => (
                        <span
                          key={index}
                          className={cn(
                            "h-1.5 rounded-full",
                            index === step
                              ? "w-5 bg-blue-500"
                              : "w-1.5 bg-muted",
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={step === 0}
                        onClick={() =>
                          setStep((value) => Math.max(0, (value ?? 0) - 1))
                        }
                      >
                        Back
                      </Button>
                      <Button
                        className="px-4 py-2 text-sm"
                        onClick={() => {
                          if (step === steps.length - 1) {
                            closeTour();
                          } else setStep((value) => (value ?? 0) + 1);
                        }}
                      >
                        {step === steps.length - 1
                          ? "Got it"
                          : "Next →"}
                      </Button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          ))}
        </div>
      </TooltipProvider>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
        <span>Other event forms</span>
        <Button
          variant="link"
          className="px-0"
          onClick={() => onSelect("rsvp")}
        >
          RSVP form
        </Button>
        <Button
          variant="link"
          className="px-0"
          onClick={() => onSelect("post-survey")}
        >
          Post-event survey
        </Button>
      </div>
    </section>
  );
}
