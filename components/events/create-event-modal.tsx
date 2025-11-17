"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Download, ArrowLeft, Plus, Paperclip } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

type CreateEventModalView = "options" | "ai" | "devpost";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PREFILL_STORAGE_KEY = "mentorMates-event-prefill";

// Right gradient panel (options view)
const primaryCard = (
  <div className="relative hidden lg:block w-[420px] shrink-0 -ml-px">
    <div className="relative h-full min-h-[520px] rounded-none lg:rounded-r-3xl overflow-hidden">
      <Image
        src="/img/gradient.png"
        alt="Gradient background"
        fill
        // Slight scale to hide any white seams from the asset
        className="object-cover scale-110"
        priority
      />

      <div className="absolute inset-0 flex items-end justify-start p-10">
        <div className="text-white text-5xl font-light tracking-wide leading-tight">
          <div>Learn,</div>
          <div>Create,</div>
          <div>Grow.</div>
        </div>
      </div>
    </div>
  </div>
);

export function CreateEventModal({
  open,
  onOpenChange,
}: CreateEventModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [view, setView] = useState<CreateEventModalView>("options");
  const [aiText, setAiText] = useState("");
  const [aiMode, setAiMode] = useState<"fill" | "generate">("fill");
  const [aiLoading, setAiLoading] = useState(false);

  const [devpostUrl, setDevpostUrl] = useState("");
  const [devpostLoading, setDevpostLoading] = useState(false);

  const closeModal = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setView("options");
        setAiText("");
        setDevpostUrl("");
        setAiMode("fill");
        setAiLoading(false);
        setDevpostLoading(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const persistPrefillAndNavigate = useCallback(
    (data: unknown) => {
      if (typeof window !== "undefined" && data) {
        window.localStorage.setItem(PREFILL_STORAGE_KEY, JSON.stringify(data));
      }
      closeModal(false);
      router.push("/events/new");
    },
    [closeModal, router]
  );

  const handleAiSubmit = async () => {
    if (!aiText.trim()) {
      toast({
        title: "Paste event details",
        description: "Add a brief or event content before using AI.",
      });
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/events/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText.trim(), mode: aiMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to parse with AI");
      }
      const payload = data?.fields || {};
      persistPrefillAndNavigate(payload);
    } catch (error) {
      console.error(error);
      toast({
        title: "AI request failed",
        description:
          error instanceof Error ? error.message : "Unable to contact AI.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleDevpostSubmit = async () => {
    if (!devpostUrl.trim()) {
      toast({
        title: "Add DevPost URL",
        description: "Paste a DevPost event link to continue.",
      });
      return;
    }
    setDevpostLoading(true);
    try {
      const res = await fetch("/api/events/import/devpost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: devpostUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to import from DevPost");
      }
      persistPrefillAndNavigate(data?.import || {});
    } catch (error) {
      console.error(error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to import from DevPost.",
        variant: "destructive",
      });
    } finally {
      setDevpostLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VIEWS
  // ---------------------------------------------------------------------------

  const renderOptions = () => (
    <div className="flex flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      {/* Left panel */}
      <div className="flex-1 px-10 py-10 lg:px-12 lg:py-12">
        <DialogTitle className="sr-only">Create event</DialogTitle>

        <h2 className="text-[22px] font-semibold mb-8 text-gray-900">
          Create new event
        </h2>

        <div className="space-y-4">
          {/* Create from scratch - primary, but no gradient until hover */}
          <button
            onClick={() => {
              closeModal(false);
              router.push("/events/new");
            }}
            className="group w-full rounded-xl border border-[#4B89EF] bg-white px-6 py-5 text-center transition-all shadow-[0_6px_18px_rgba(15,23,42,0.10)] hover:bg-[linear-gradient(203deg,_#DBEAFE_13.19%,_rgba(255,255,255,0)_65.83%)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.20)]"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9D2FF] bg-white shadow-[0_6px_15px_rgba(15,23,42,0.06)] group-hover:border-[#4B89EF]">
                <Plus className="h-5 w-5 text-[#4B89EF]" />
              </span>
              <div className="space-y-1">
                <p className="text-[15px] font-semibold text-gray-900">
                  Create from scratch
                </p>
                <p className="text-xs text-gray-500">
                  Create event as you wish
                </p>
              </div>
            </div>
          </button>

          {/* Start with AI */}
          <button
            onClick={() => setView("ai")}
            className="group w-full rounded-xl border border-[#E4E4E7] bg-white px-6 py-5 text-center transition-all hover:border-[#4B89EF] hover:bg-[linear-gradient(203deg,_#DBEAFE_13.19%,_rgba(255,255,255,0)_65.83%)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.20)]"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4FF] group-hover:bg-white group-hover:border group-hover:border-[#4B89EF]">
                <Sparkles className="h-5 w-5 text-[#6E56CF]" />
              </span>
              <div className="space-y-1">
                <p className="text-[15px] font-semibold text-gray-900">
                  Start with AI
                </p>
                <p className="text-xs text-gray-500">Create from a prompt</p>
              </div>
            </div>
          </button>

          {/* Import from DevPost */}
          <button
            onClick={() => setView("devpost")}
            className="group w-full rounded-xl border border-[#E4E4E7] bg-white px-6 py-5 text-center transition-all hover:border-[#4B89EF] hover:bg-[linear-gradient(203deg,_#DBEAFE_13.19%,_rgba(255,255,255,0)_65.83%)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.20)]"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black group-hover:ring-1 group-hover:ring-offset-2 group-hover:ring-[#4B89EF] group-hover:ring-offset-transparent">
                <span className="text-white font-semibold text-base">D</span>
              </span>
              <div className="space-y-1">
                <p className="text-[15px] font-semibold text-gray-900">
                  Import from DevPost
                </p>
                <p className="text-xs text-gray-500">
                  Just paste the event link
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Right gradient panel */}
      {primaryCard}
    </div>
  );

  const renderAiView = () => (
    <div className="flex flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      <div className="flex-1 px-8 py-8 lg:px-10 lg:py-10 space-y-6">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-[#4B89EF]"
          onClick={() => setView("options")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="space-y-2">
          <h2 className="text-[20px] font-semibold tracking-tight">
            Start with AI
          </h2>

          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#4B89EF]"
            onClick={() =>
              setAiMode((prev) => (prev === "fill" ? "generate" : "fill"))
            }
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate or fill with AI</span>
          </button>
        </div>

        <Textarea
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="Paste event details or a short brief here"
          className="min-h-[220px]"
        />

        <div className="flex items-center justify-between pt-2">
          {/* You still keep the mode toggle logic, just subtler */}
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`px-3 py-1.5 rounded-full border cursor-pointer ${
                aiMode === "fill"
                  ? "border-[#4B89EF] text-[#4B89EF] bg-[#EEF2FF]"
                  : "border-transparent bg-gray-100"
              }`}
              onClick={() => setAiMode("fill")}
            >
              Fill existing info
            </span>
            <span
              className={`px-3 py-1.5 rounded-full border cursor-pointer ${
                aiMode === "generate"
                  ? "border-[#4B89EF] text-[#4B89EF] bg-[#EEF2FF]"
                  : "border-transparent bg-gray-100"
              }`}
              onClick={() => setAiMode("generate")}
            >
              Generate from brief
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setView("options")}
            >
              Back
            </Button>
            <Button
              onClick={handleAiSubmit}
              disabled={aiLoading}
              className="inline-flex items-center gap-2"
            >
              {aiLoading ? "Working..." : "Fill with AI"}
              {!aiLoading && <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {primaryCard}
    </div>
  );

  const renderDevpostView = () => (
    <div className="flex flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      <div className="flex-1 px-8 py-8 lg:px-10 lg:py-10 space-y-6">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-[#4B89EF]"
          onClick={() => setView("options")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="space-y-2">
          <h2 className="text-[20px] font-semibold tracking-tight">
            Import from DevPost
          </h2>
          <p className="text-sm text-gray-700">
            Paste the DevPost event link and we&apos;ll handle the rest.
          </p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Paperclip className="h-4 w-4 text-gray-400" />
            </span>
            <Input
              value={devpostUrl}
              onChange={(e) => setDevpostUrl(e.target.value)}
              placeholder="https://..."
              className="pl-9 h-11 rounded-xl text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground italic">
            *It takes about 1–2 minutes to finish parsing. Please wait
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={() => setView("options")}
            className="min-w-[90px]"
          >
            Back
          </Button>
          <Button
            onClick={handleDevpostSubmit}
            disabled={devpostLoading}
            className="min-w-[120px] inline-flex items-center gap-2"
          >
            {devpostLoading ? "Importing..." : "Create event"}
            {!devpostLoading && <Download className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {primaryCard}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="max-w-5xl w-full border-none bg-transparent p-0 shadow-none">
        {view === "options" && renderOptions()}
        {view === "ai" && renderAiView()}
        {view === "devpost" && renderDevpostView()}
      </DialogContent>
    </Dialog>
  );
}
