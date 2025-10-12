"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Lightbulb, X } from "lucide-react";

interface GiveFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectId: string;
}

export function GiveFeedbackDialog({
  open,
  onOpenChange,
  projectName,
  projectId,
}: GiveFeedbackDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEnhanceWithAI = async () => {
    setShowAISuggestions(true);
    // TODO: Implement AI enhancement
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // TODO: Implement feedback submission
      onOpenChange(false);
      setFeedback("");
      setShowAISuggestions(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
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

  const aiSuggestions = [
    {
      title: "More specific",
      text: "The app effectively introduces chess concepts to kindergarteners; including interactive tutorials can enhance understanding.",
    },
    {
      title: "More actionable",
      text: "The app engages young learners; incorporating colorful animations could capture their attention better.",
    },
    {
      title: "More positive",
      text: "The app has a wonderful foundation for teaching chess! Adding playful elements can increase its appeal to children.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[890px] p-0 gap-0">
        <div className="flex">
          {/* Left side - Main content */}
          <div className="flex-1 flex flex-col">
            <DialogHeader className="p-6 pb-3">
              <DialogTitle className="text-[22px] font-semibold tracking-tight">
                Share feedback for{" "}
                <span className="text-[#4b89ef]">{projectName}</span>
              </DialogTitle>
              <p className="text-sm text-zinc-500 font-normal mt-1.5">
                Help this project improve by sharing your thoughts, suggestions,
                and ideas.
              </p>
            </DialogHeader>

            <div className="flex flex-col gap-2.5 px-6 pb-6">
              {!showAISuggestions ? (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-6 h-6" />
                      <span
                        className="text-[16px] bg-clip-text text-transparent"
                        style={{
                          backgroundImage:
                            "linear-gradient(90deg, rgb(165, 20, 250) 0%, rgb(73, 200, 242) 100%)",
                        }}
                      >
                        Enhance with AI
                      </span>
                    </div>
                    <Textarea
                      placeholder="Long description or markdown"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="min-h-[164px] resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleEnhanceWithAI}
                    className="w-full bg-[#4b89ef] hover:bg-[#3d75d9] text-white"
                    disabled={!feedback.trim()}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Improve feedback with AI
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <Textarea
                      placeholder="Long description or markdown"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="min-h-[179px] resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-[#4b89ef] hover:bg-[#3d75d9] text-white"
                    disabled={isSubmitting || !feedback.trim()}
                  >
                    {isSubmitting ? "Submitting..." : "Submit feedback"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right side - Tips/Suggestions */}
          <div className="w-[450px] bg-gradient-to-b from-[#dbeafe] to-[#f9f9ff] p-6 rounded-br-md rounded-tr-md">
            <div className="bg-white rounded-[13px] p-1.5 w-fit mb-4">
              <Lightbulb className="w-6 h-6" />
            </div>

            <div className="flex items-center justify-center pb-2 pt-4">
              <p className="text-[16px] font-medium text-black">
                {!showAISuggestions ? "Writing Tips" : "AI Suggestions"}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {!showAISuggestions ? (
                <>
                  <div className="flex flex-col gap-1 py-3 border-b border-[#d8d8d8]">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      01
                    </p>
                    <p className="text-sm text-zinc-500 leading-[22px]">
                      What should they do next to improve the project?
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 py-3 border-b border-[#d8d8d8]">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      02
                    </p>
                    <p className="text-sm text-zinc-500 leading-[22px]">
                      What could be better or work differently?
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 py-3">
                    <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                      03
                    </p>
                    <p className="text-sm text-zinc-500 leading-[22px]">
                      What works well, and are there similar projects to learn
                      from?
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {aiSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-2 py-3 border-b border-[#d8d8d8] last:border-b-0"
                    >
                      <p className="text-[24px] leading-5 text-zinc-900 font-['Poly']">
                        {suggestion.title}
                      </p>
                      <p className="text-sm text-zinc-500 leading-[22px]">
                        {suggestion.text}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReplaceSuggestion(suggestion.text)}
                          className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => handleAddBelowSuggestion(suggestion.text)}
                          className="text-[#4b89ef] text-[16px] font-medium underline decoration-solid"
                        >
                          Add below
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
