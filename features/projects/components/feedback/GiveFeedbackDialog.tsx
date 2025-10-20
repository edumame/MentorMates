"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Lightbulb, Loader2, X } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import Link from "next/link";

interface AISuggestions {
  "more specific": string;
  "more actionable": string;
  "more positive": string;
}

interface GiveFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectId: string;
  projectDescription?: string;
  eventId?: string;
}

export function GiveFeedbackDialog({
  open,
  onOpenChange,
  projectName,
  projectId,
  projectDescription = "",
  eventId = "",
}: GiveFeedbackDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(
    null
  );
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea (caps at 300px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 300);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [feedback]);

  const handleEnhanceWithAI = async () => {
    try {
      setIsGeneratingAI(true);
      localStorage.setItem(`originalFeedback_${projectId}`, feedback);

      const res = await fetch(
        "https://magicloops.dev/api/loop/b59e7eb1-4d27-4fa7-8411-543646f3ee2f/run",
        {
          method: "POST",
          body: JSON.stringify({
            feedback,
            "project description": projectDescription,
          }),
        }
      );
      const json = await res.json();
      setAiSuggestions(json);
      // If you want to auto-insert a suggestion, you could:
      // setFeedback(json?.["more actionable"] || feedback);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to generate AI suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const originalFeedback =
        localStorage.getItem(`originalFeedback_${projectId}`) || feedback;

      const payload = {
        project_id: projectId,
        mentor_id: null,
        mentor_name: null,
        mentor_email: null,
        feedback_text: feedback,
        original_feedback_text: originalFeedback,
        modifier_field: aiSuggestions ? ["ai_enhanced"] : [],
        specific_ai_suggestion: aiSuggestions?.["more specific"] || "",
        positive_ai_suggestion: aiSuggestions?.["more positive"] || "",
        actionable_ai_suggestion: aiSuggestions?.["more actionable"] || "",
        event_id: eventId || "",
      };

      const res = await fetch(`/api/feedback/submit/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit feedback");

      setIsSubmitted(true);
      localStorage.removeItem(`originalFeedback_${projectId}`);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description:
          e instanceof Error ? e.message : "Failed to submit feedback.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // reset after close animation
    setTimeout(() => {
      setFeedback("");
      setAiSuggestions(null);
      setIsSubmitted(false);
      setIsGeneratingAI(false);
      setIsSubmitting(false);
    }, 220);
  };

  /* ---------------- Success State (unchanged behavior) ---------------- */
  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="p-0 border border-zinc-200 !max-w-none rounded-none sm:rounded-lg"
          style={{
            display: "flex",
            width: 888,
            alignItems: "flex-start",
            maxWidth: "calc(100vw - 2rem)",
            overflow: "hidden",
          }}
        >
          <div className="flex h-full w-full flex-col overflow-y-auto md:flex-row md:overflow-hidden flex-1">
            <div className="flex min-w-0 grow basis-0 flex-col items-center justify-center border-b border-zinc-200 px-4 py-6 md:border-b-0 md:p-6 md:pr-4">
              <div className="flex max-w-md flex-col items-center gap-1.5 text-center">
                <div className="mb-2 h-16 w-16">
                  <span className="text-6xl">🥰</span>
                </div>
                <DialogTitle className="text-[22px] font-semibold leading-[1.4] tracking-[-1.32px] text-zinc-900">
                  Your feedback has been submitted
                </DialogTitle>
                <p className="text-sm leading-[1.5] text-zinc-500">
                  Thank you for giving feedback to{" "}
                  <span className="text-[#4b89ef]">{projectName}</span>!
                  They&apos;ll find it helpful to improve their work.
                </p>
              </div>
            </div>

            <div
              className="w-full shrink-0 md:w-[450px] md:rounded-b-none md:rounded-br-[6px] md:rounded-tr-[6px] px-4 py-6 md:p-6 md:pl-4"
              style={{
                borderTopRightRadius: "var(--radius-rounded-md, 6px)",
                borderBottomRightRadius: "var(--radius-rounded-md, 6px)",
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                background: "linear-gradient(180deg, #DBEAFE 0%, #F9F9FF 100%)",
              }}
            >
              <div className="flex w-full flex-col items-center gap-3 text-center">
                <div className="flex flex-col gap-3 py-3">
                  <p className="font-['Poly'] text-[24px] leading-5 text-zinc-900">
                    Interested in Similar Projects?
                  </p>
                  <p className="text-sm leading-[22px] text-zinc-500">
                    Join our community to discover more innovative projects and
                    connect with creators.
                  </p>
                </div>
                <Button
                  asChild
                  className="h-10 rounded-xl bg-[#4b89ef] px-6 py-2.5 text-sm font-medium text-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:bg-[#3d75d9]"
                >
                  <Link href="/events">Explore events</Link>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  /* ---------------- Main Dialog (matches screenshot) ---------------- */
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 border border-zinc-200 bg-white shadow-xl !max-w-none rounded-none sm:rounded-lg"
        style={{
          display: "flex",
          width: 888,
          alignItems: "flex-start",
          maxWidth: "calc(100vw - 2rem)",
          overflow: "hidden",
        }}
      >
        {/* Close in top-right (on the right pane visually) */}
        <DialogClose className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="flex min-h-[600px] flex-col flex-1 lg:flex-row">
          {/* LEFT: Input panel */}
          <div className="flex-1 bg-white px-6 py-6 lg:px-8 lg:py-8">
            <div className="flex h-full flex-col">
              {/* Title + helper */}
              <div className="mb-3">
                <DialogTitle className="text-[18px] font-semibold leading-[1.35] text-zinc-900">
                  Share feedback for{" "}
                  <button
                    type="button"
                    className="align-baseline text-[#4B89EF] hover:underline"
                  >
                    {projectName}
                  </button>
                </DialogTitle>
                <p className="mt-1 max-w-[440px] text-[12px] leading-[1.5] text-zinc-600">
                  Help this project improve by sharing your thoughts,
                  suggestions, and ideas.
                </p>
              </div>

              {/* subtle hairline divider (seen in mock) */}
              <div className="mb-3 h-px w-full bg-zinc-200" />

              {/* Enhance with AI (purple link) */}
              <button
                onClick={handleEnhanceWithAI}
                disabled={isGeneratingAI || !feedback.trim()}
                className="mb-3 inline-flex items-center gap-2 text-[14px] font-medium text-[#6E56CF] hover:opacity-90 disabled:opacity-40"
              >
                {isGeneratingAI ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGeneratingAI ? "Enhancing with AI..." : "Enhance with AI"}
              </button>

              {/* Textarea */}
              <div className="mb-6 flex-1">
                <Textarea
                  ref={textareaRef}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Long description or markdown"
                  className="min-h-[220px] w-full resize-none rounded-[10px] border border-[rgba(0,0,0,0.12)] p-4 text-[14px] leading-[1.5] text-zinc-900 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4B89EF]/60"
                />
              </div>

              {/* Primary CTA (full width like screenshot) */}
              <div className="mt-auto">
                <Button
                  onClick={handleSubmit}
                  disabled={!feedback.trim() || isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#4B89EF] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#3F77D3] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Improve feedback with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT: Tips panel */}
          <div
            className="flex-1 border-l border-[rgba(0,0,0,0.10)] px-6 py-6 lg:px-8 lg:py-8"
            style={{
              borderTopRightRadius: "var(--radius-rounded-md, 6px)",
              borderBottomRightRadius: "var(--radius-rounded-md, 6px)",
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              background: "linear-gradient(180deg, #DBEAFE 0%, #F9F9FF 100%)",
            }}
          >
            <div className="flex h-full flex-col">
              {/* Lightbulb + Heading */}
              <div className="mb-5 flex items-center gap-3">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 ring-1 ring-[rgba(0,0,0,0.1)]">
                  <Lightbulb className="h-4 w-4 text-[#7C8DB5]" />
                </div>
                <h3 className="text-[16px] font-semibold leading-[1.4] text-zinc-900">
                  Writing Tips
                </h3>
              </div>

              {/* Tips list (01/02/03 + dividers) */}
              <div className="space-y-6">
                {/* 01 */}
                <div>
                  <p className="text-[18px] font-medium tracking-tight text-zinc-900">
                    01
                  </p>
                  <p className="mt-1 max-w-[440px] text-[13px] leading-[1.55] text-zinc-600">
                    What should they do next to improve the project?
                  </p>
                  <div className="mt-4 h-px w-full bg-[rgba(0,0,0,0.08)]" />
                </div>

                {/* 02 */}
                <div>
                  <p className="text-[18px] font-medium tracking-tight text-zinc-900">
                    02
                  </p>
                  <p className="mt-1 max-w-[440px] text-[13px] leading-[1.55] text-zinc-600">
                    What could be better or work differently?
                  </p>
                  <div className="mt-4 h-px w-full bg-[rgba(0,0,0,0.08)]" />
                </div>

                {/* 03 */}
                <div>
                  <p className="text-[18px] font-medium tracking-tight text-zinc-900">
                    03
                  </p>
                  <p className="mt-1 max-w-[440px] text-[13px] leading-[1.55] text-zinc-600">
                    What works well, and are there similar projects to learn
                    from?
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
