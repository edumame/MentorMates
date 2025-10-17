"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Lightbulb } from "lucide-react";
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

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 300);
      textareaRef.current.style.height = newHeight + "px";
    }
  }, [feedback]);

  const handleEnhanceWithAI = async () => {
    setIsGeneratingAI(true);

    // Save original feedback to localStorage before AI enhancement
    localStorage.setItem(`originalFeedback_${projectId}`, feedback);

    try {
      const url =
        "https://magicloops.dev/api/loop/b59e7eb1-4d27-4fa7-8411-543646f3ee2f/run";
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({
          feedback: feedback,
          "project description": projectDescription,
        }),
      });
      const responseJson = await response.json();
      setAiSuggestions(responseJson);
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
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
    setIsSubmitting(true);
    try {
      const originalFeedback =
        localStorage.getItem(`originalFeedback_${projectId}`) || feedback;

      const feedbackBody = {
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
        event_id: eventId,
      };

      const response = await fetch(`/api/feedback/submit/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(feedbackBody),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        localStorage.removeItem(`originalFeedback_${projectId}`);
      } else {
        throw new Error(data.error || "Failed to submit feedback");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplaceSuggestion = (suggestion: string) => {
    setFeedback(suggestion);
  };

  const handleAddBelowSuggestion = (suggestion: string) => {
    setFeedback(feedback + "\n\n" + suggestion);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation completes
    setTimeout(() => {
      setFeedback("");
      setAiSuggestions(null);
      setIsSubmitted(false);
    }, 300);
  };

  // Success state
  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-full sm:w-[95vw] !max-w-[888px] md:w-[888px] p-0 gap-0 border border-zinc-200 max-h-[100dvh] md:max-h-none h-auto md:h-[533px] overflow-hidden rounded-none sm:rounded-lg">
          <div className="flex flex-col md:flex-row h-full w-full overflow-y-auto md:overflow-hidden">
            {/* Left side - Success message */}
            <div className="flex flex-col items-center justify-center min-w-0 w-full px-4 py-6 md:p-6 md:basis-0 md:grow md:pr-4 border-b md:border-b-0 border-zinc-200">
              <div className="flex flex-col items-center gap-1.5 text-center max-w-md">
                <div className="w-16 h-16 mb-2">
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

            {/* Right side - CTA */}
            <div className="w-full md:w-[450px] bg-gradient-to-b from-[#dbeafe] to-[#f9f9ff] px-4 py-6 md:p-6 md:pl-4 flex flex-col items-center justify-center md:shrink-0 rounded-b-[6px] md:rounded-b-none md:rounded-br-[6px] md:rounded-tr-[6px]">
              <div className="flex flex-col items-center gap-3 text-center w-full">
                <div className="flex flex-col gap-3 py-3">
                  <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                    Interested in Similar Projects?
                  </p>
                  <p className="text-sm leading-[22px] text-zinc-500">
                    Join our community to discover more innovative projects and
                    connect with creators.
                  </p>
                </div>
                <Button
                  asChild
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 text-sm font-medium h-10 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:w-[95vw] !max-w-[888px] md:w-[888px] p-0 gap-0 border border-zinc-200 max-h-[100dvh] md:max-h-none h-auto md:h-[533px] overflow-hidden rounded-none sm:rounded-lg">
        <div className="flex flex-col md:flex-row h-full w-full overflow-y-auto md:overflow-hidden">
          {/* Left side - Main content */}
          <div className="flex flex-col min-w-0 w-full md:basis-0 md:grow md:pr-4">
            {/* Header */}
            <div className="flex flex-col gap-1.5 px-4 py-4 md:p-6 md:pr-0 border-b md:border-b-0 border-zinc-200">
              <DialogTitle className="text-[18px] md:text-[22px] font-semibold leading-[1.4] tracking-[-1.32px] text-zinc-900">
                Share feedback for{" "}
                <span className="text-[#4b89ef]">{projectName}</span>
              </DialogTitle>
              <p className="text-sm leading-[1.5] text-zinc-500">
                Help this project improve by sharing your thoughts, suggestions,
                and ideas.
              </p>
            </div>

            {/* Content */}
            <div className="flex flex-col px-4 py-4 md:px-6 md:pr-0 md:pb-6 flex-1">
              <div className="flex flex-col gap-4">
                {!aiSuggestions && (
                  <div className="flex gap-1 items-center">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    <span
                      className="text-[16px] leading-[1.5] bg-clip-text text-transparent font-normal"
                      style={{
                        backgroundImage:
                          "linear-gradient(90deg, rgb(165, 20, 250) 0%, rgb(73, 200, 242) 100%)",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Enhance with AI
                    </span>
                  </div>
                )}
                <Textarea
                  ref={textareaRef}
                  placeholder="Long description or markdown"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className={`resize-none border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 text-[16px] overflow-y-auto ${!aiSuggestions ? "min-h-[164px] max-h-[300px]" : "min-h-[179px] max-h-[300px]"}`}
                  rows={1}
                />
              </div>

              {/* Spacer to push button to bottom */}
              <div className="flex-1 min-h-[16px]" />

              {!aiSuggestions ? (
                <Button
                  onClick={handleEnhanceWithAI}
                  disabled={!feedback.trim() || isGeneratingAI}
                  className="w-full bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 text-[16px] font-medium h-auto shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                >
                  <Sparkles className="w-6 h-6 mr-1.5" />
                  {isGeneratingAI
                    ? "Generating..."
                    : "Improve feedback with AI"}
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !feedback.trim()}
                  className="w-full bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 text-[16px] font-medium h-auto shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                >
                  {isSubmitting ? "Submitting..." : "Submit feedback"}
                </Button>
              )}
            </div>
          </div>

          {/* Right side - Tips/Suggestions */}
          <div className="w-full md:w-[450px] bg-gradient-to-b from-[#dbeafe] to-[#f9f9ff] px-4 py-4 md:p-6 md:pl-4 flex flex-col md:shrink-0 rounded-b-[6px] md:rounded-b-none md:rounded-br-[6px] md:rounded-tr-[6px]">
            <div className="bg-white rounded-[13px] p-1.5 w-fit">
              <Lightbulb className="w-6 h-6" />
            </div>

            <div className="flex items-center justify-center pb-2 pt-4">
              <p className="text-[16px] font-medium leading-[1.5] text-black">
                {!aiSuggestions ? "Writing Tips" : "AI Suggestions"}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {!aiSuggestions ? (
                <>
                  <div className="flex flex-col gap-1 py-3">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      01
                    </p>
                    <p className="text-sm leading-[22px] text-zinc-500">
                      What should they do next to improve the project?
                    </p>
                  </div>
                  <div className="h-px bg-[#d8d8d8]" />
                  <div className="flex flex-col gap-1 py-3">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      02
                    </p>
                    <p className="text-sm leading-[22px] text-zinc-500">
                      What could be better or work differently?
                    </p>
                  </div>
                  <div className="h-px bg-[#d8d8d8]" />
                  <div className="flex flex-col gap-1 py-3">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      03
                    </p>
                    <p className="text-sm leading-[22px] text-zinc-500">
                      What works well, and are there similar projects to learn
                      from?
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-2 py-3">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      More specific
                    </p>
                    <p className="text-sm leading-[22px] text-zinc-500">
                      {aiSuggestions["more specific"]}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleReplaceSuggestion(
                            aiSuggestions["more specific"]
                          )
                        }
                        className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid tracking-[-0.64px]"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() =>
                          handleAddBelowSuggestion(
                            aiSuggestions["more specific"]
                          )
                        }
                        className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid tracking-[-0.64px]"
                      >
                        Add below
                      </button>
                    </div>
                  </div>
                  <div className="h-px bg-[#d8d8d8]" />
                  <div className="flex flex-col gap-2 py-3">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      More actionable
                    </p>
                    <p className="text-sm leading-[22px] text-zinc-500">
                      {aiSuggestions["more actionable"]}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleReplaceSuggestion(
                            aiSuggestions["more actionable"]
                          )
                        }
                        className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid tracking-[-0.64px]"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() =>
                          handleAddBelowSuggestion(
                            aiSuggestions["more actionable"]
                          )
                        }
                        className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid tracking-[-0.64px]"
                      >
                        Add below
                      </button>
                    </div>
                  </div>
                  <div className="h-px bg-[#d8d8d8]" />
                  <div className="flex flex-col gap-2 py-3">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      More positive
                    </p>
                    <p className="text-sm leading-[22px] text-zinc-500">
                      {aiSuggestions["more positive"]}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleReplaceSuggestion(
                            aiSuggestions["more positive"]
                          )
                        }
                        className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid tracking-[-0.64px]"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() =>
                          handleAddBelowSuggestion(
                            aiSuggestions["more positive"]
                          )
                        }
                        className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid tracking-[-0.64px]"
                      >
                        Add below
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
