"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Download, Plus, Paperclip } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

type CreateEventModalView = "options" | "ai" | "devpost";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PREFILL_STORAGE_KEY = "mentorMates-event-prefill";

// Simple custom AI icon
function StartWithAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M16.3847 12.7216L14.0499 16.4864C13.9166 16.7071 13.7281 16.7924 13.4844 16.7424C13.2408 16.6924 13.0856 16.5487 13.0189 16.3114L12.1999 13.0041L4.63969 20.5276C4.46969 20.7015 4.27077 20.7884 4.04294 20.7884C3.8151 20.7884 3.61619 20.7015 3.44619 20.5276C3.27635 20.3576 3.19144 20.1587 3.19144 19.9309C3.19144 19.7031 3.27635 19.5041 3.44619 19.3341L10.9814 11.8049L7.66244 10.9856C7.4251 10.919 7.28244 10.7639 7.23444 10.5204C7.18644 10.2767 7.27077 10.0862 7.48744 9.94889L11.2522 7.58914L10.9462 3.18738C10.9295 2.93338 11.0347 2.74805 11.2617 2.63138C11.4887 2.51472 11.6959 2.53972 11.8832 2.70639L15.2609 5.54714L19.3564 3.90538C19.5898 3.82205 19.7918 3.86572 19.9624 4.03639C20.1331 4.20705 20.1768 4.40905 20.0934 4.64239L18.4267 8.73789L21.2674 12.1216C21.4341 12.309 21.4633 12.5161 21.3549 12.7431C21.2466 12.9701 21.0654 13.0753 20.8114 13.0586L16.3847 12.7216ZM3.16044 5.99889C3.0691 5.91155 3.02344 5.80889 3.02344 5.69089C3.02344 5.57305 3.0691 5.46847 3.16044 5.37714L4.38219 4.15538C4.46952 4.06805 4.5721 4.02438 4.68994 4.02438C4.80794 4.02438 4.9126 4.06805 5.00394 4.15538L6.19469 5.35214C6.28585 5.44347 6.33144 5.54705 6.33144 5.66289C6.33144 5.77889 6.28585 5.88255 6.19469 5.97389L4.97294 7.19564C4.8816 7.2868 4.77794 7.33239 4.66194 7.33239C4.5461 7.33239 4.44252 7.2868 4.35119 7.19564L3.16044 5.99889ZM13.9859 13.5364L15.5249 11.0581L18.4472 11.2771L16.5452 9.03688L17.6462 6.33363L14.9429 7.42864L12.6967 5.52664L12.9217 8.44889L10.4374 10.0069L13.2847 10.7141L13.9859 13.5364ZM18.0249 20.8384L16.8032 19.6226C16.712 19.5313 16.6706 19.4277 16.6789 19.3119C16.6873 19.1959 16.737 19.0922 16.8282 19.0009L18.0249 17.8101C18.1123 17.7188 18.2149 17.6731 18.3329 17.6731C18.4508 17.6731 18.5554 17.7188 18.6467 17.8101L19.8684 19.0259C19.9558 19.1172 19.9953 19.2209 19.9869 19.3369C19.9786 19.4527 19.9308 19.5563 19.8434 19.6476L18.6467 20.8384C18.5554 20.9297 18.4518 20.9754 18.3359 20.9754C18.2199 20.9754 18.1163 20.9297 18.0249 20.8384Z" fill="black"/>
  <path d="M16.3847 12.7216L14.0499 16.4864C13.9166 16.7071 13.7281 16.7924 13.4844 16.7424C13.2408 16.6924 13.0856 16.5487 13.0189 16.3114L12.1999 13.0041L4.63969 20.5276C4.46969 20.7015 4.27077 20.7884 4.04294 20.7884C3.8151 20.7884 3.61619 20.7015 3.44619 20.5276C3.27635 20.3576 3.19144 20.1587 3.19144 19.9309C3.19144 19.7031 3.27635 19.5041 3.44619 19.3341L10.9814 11.8049L7.66244 10.9856C7.4251 10.919 7.28244 10.7639 7.23444 10.5204C7.18644 10.2767 7.27077 10.0862 7.48744 9.94889L11.2522 7.58914L10.9462 3.18738C10.9295 2.93338 11.0347 2.74805 11.2617 2.63138C11.4887 2.51472 11.6959 2.53972 11.8832 2.70639L15.2609 5.54714L19.3564 3.90538C19.5898 3.82205 19.7918 3.86572 19.9624 4.03639C20.1331 4.20705 20.1768 4.40905 20.0934 4.64239L18.4267 8.73789L21.2674 12.1216C21.4341 12.309 21.4633 12.5161 21.3549 12.7431C21.2466 12.9701 21.0654 13.0753 20.8114 13.0586L16.3847 12.7216ZM3.16044 5.99889C3.0691 5.91155 3.02344 5.80889 3.02344 5.69089C3.02344 5.57305 3.0691 5.46847 3.16044 5.37714L4.38219 4.15538C4.46952 4.06805 4.5721 4.02438 4.68994 4.02438C4.80794 4.02438 4.9126 4.06805 5.00394 4.15538L6.19469 5.35214C6.28585 5.44347 6.33144 5.54705 6.33144 5.66289C6.33144 5.77889 6.28585 5.88255 6.19469 5.97389L4.97294 7.19564C4.8816 7.2868 4.77794 7.33239 4.66194 7.33239C4.5461 7.33239 4.44252 7.2868 4.35119 7.19564L3.16044 5.99889ZM13.9859 13.5364L15.5249 11.0581L18.4472 11.2771L16.5452 9.03688L17.6462 6.33363L14.9429 7.42864L12.6967 5.52664L12.9217 8.44889L10.4374 10.0069L13.2847 10.7141L13.9859 13.5364ZM18.0249 20.8384L16.8032 19.6226C16.712 19.5313 16.6706 19.4277 16.6789 19.3119C16.6873 19.1959 16.737 19.0922 16.8282 19.0009L18.0249 17.8101C18.1123 17.7188 18.2149 17.6731 18.3329 17.6731C18.4508 17.6731 18.5554 17.7188 18.6467 17.8101L19.8684 19.0259C19.9558 19.1172 19.9953 19.2209 19.9869 19.3369C19.9786 19.4527 19.9308 19.5563 19.8434 19.6476L18.6467 20.8384C18.5554 20.9297 18.4518 20.9754 18.3359 20.9754C18.2199 20.9754 18.1163 20.9297 18.0249 20.8384Z" fill="url(#paint0_linear_1956_25104)"/>
  <path d="M16.3847 12.7216L14.0499 16.4864C13.9166 16.7071 13.7281 16.7924 13.4844 16.7424C13.2408 16.6924 13.0856 16.5487 13.0189 16.3114L12.1999 13.0041L4.63969 20.5276C4.46969 20.7015 4.27077 20.7884 4.04294 20.7884C3.8151 20.7884 3.61619 20.7015 3.44619 20.5276C3.27635 20.3576 3.19144 20.1587 3.19144 19.9309C3.19144 19.7031 3.27635 19.5041 3.44619 19.3341L10.9814 11.8049L7.66244 10.9856C7.4251 10.919 7.28244 10.7639 7.23444 10.5204C7.18644 10.2767 7.27077 10.0862 7.48744 9.94889L11.2522 7.58914L10.9462 3.18738C10.9295 2.93338 11.0347 2.74805 11.2617 2.63138C11.4887 2.51472 11.6959 2.53972 11.8832 2.70639L15.2609 5.54714L19.3564 3.90538C19.5898 3.82205 19.7918 3.86572 19.9624 4.03639C20.1331 4.20705 20.1768 4.40905 20.0934 4.64239L18.4267 8.73789L21.2674 12.1216C21.4341 12.309 21.4633 12.5161 21.3549 12.7431C21.2466 12.9701 21.0654 13.0753 20.8114 13.0586L16.3847 12.7216ZM3.16044 5.99889C3.0691 5.91155 3.02344 5.80889 3.02344 5.69089C3.02344 5.57305 3.0691 5.46847 3.16044 5.37714L4.38219 4.15538C4.46952 4.06805 4.5721 4.02438 4.68994 4.02438C4.80794 4.02438 4.9126 4.06805 5.00394 4.15538L6.19469 5.35214C6.28585 5.44347 6.33144 5.54705 6.33144 5.66289C6.33144 5.77889 6.28585 5.88255 6.19469 5.97389L4.97294 7.19564C4.8816 7.2868 4.77794 7.33239 4.66194 7.33239C4.5461 7.33239 4.44252 7.2868 4.35119 7.19564L3.16044 5.99889ZM13.9859 13.5364L15.5249 11.0581L18.4472 11.2771L16.5452 9.03688L17.6462 6.33363L14.9429 7.42864L12.6967 5.52664L12.9217 8.44889L10.4374 10.0069L13.2847 10.7141L13.9859 13.5364ZM18.0249 20.8384L16.8032 19.6226C16.712 19.5313 16.6706 19.4277 16.6789 19.3119C16.6873 19.1959 16.737 19.0922 16.8282 19.0009L18.0249 17.8101C18.1123 17.7188 18.2149 17.6731 18.3329 17.6731C18.4508 17.6731 18.5554 17.7188 18.6467 17.8101L19.8684 19.0259C19.9558 19.1172 19.9953 19.2209 19.9869 19.3369C19.9786 19.4527 19.9308 19.5563 19.8434 19.6476L18.6467 20.8384C18.5554 20.9297 18.4518 20.9754 18.3359 20.9754C18.2199 20.9754 18.1163 20.9297 18.0249 20.8384Z" fill="url(#paint1_linear_1956_25104)"/>
  <defs>
    <linearGradient id="paint0_linear_1956_25104" x1="3.02344" y1="11.7674" x2="21.419" y2="11.7674" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2DC7FA"/>
      <stop offset="1" stop-color="#058E5C"/>
    </linearGradient>
    <linearGradient id="paint1_linear_1956_25104" x1="3.02344" y1="11.7674" x2="21.419" y2="11.7674" gradientUnits="userSpaceOnUse">
      <stop stop-color="#A514FA"/>
      <stop offset="1" stop-color="#49C8F2"/>
    </linearGradient>
  </defs>
</svg>
  );
}

// Right gradient panel – 50% on lg
const PrimaryCard = () => (
  <div className="relative hidden lg:block w-full lg:w-1/2 shrink-0 -ml-px">
    <div className="relative h-full min-h-[520px] rounded-none lg:rounded-r-3xl overflow-hidden">
      <Image
        src="/img/gradient.png"
        alt="Gradient background"
        fill
        className="object-cover scale-110"
        priority
      />
      <div className="absolute inset-0 flex items-end justify-start p-10">
        <div className="text-white text-5xl font-extrabold tracking-wide leading-tight">
          <div>Learn,</div>
          <div>Create,</div>
          <div>Grow.</div>
        </div>
      </div>
    </div>
  </div>
);

export function CreateEventModal({ open, onOpenChange }: CreateEventModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [view, setView] = useState<CreateEventModalView>("options");
  const [aiText, setAiText] = useState("");
  const [aiMode] = useState<"fill" | "generate">("fill");
  const [aiLoading, setAiLoading] = useState(false);

  const [devpostUrl, setDevpostUrl] = useState("");
  const [devpostLoading, setDevpostLoading] = useState(false);

  const closeModal = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setView("options");
        setAiText("");
        setDevpostUrl("");
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
    <div className="flex w-full flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      {/* Left panel – 50% on lg */}
      <div className="w-full lg:w-1/2 px-10 py-10 lg:px-12 lg:py-12">
        <DialogTitle className="sr-only">Create event</DialogTitle>

        <h2 className="text-[22px] font-semibold mb-8 text-gray-900">
          Create new event
        </h2>

        <div className="space-y-4">
          {/* Create from scratch */}
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
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl group-hover:bg-white group-hover:border group-hover:border-[#4B89EF]">
                <StartWithAiIcon />
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
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl group-hover:border group-hover:border-[#4B89EF] group-hover:bg-white">
                <Image
                  src="/img/devpost.png"
                  alt="DevPost"
                  width={24}
                  height={24}
                />
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

      <PrimaryCard />
    </div>
  );

  const renderAiView = () => (
    <div className="flex w-full flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      {/* Left – 50% on lg, vertically centered */}
      <div className="w-full lg:w-1/2 px-8 py-8 lg:px-10 lg:py-10 flex flex-col justify-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          Start with AI
        </h2>

        <div className="flex items-center gap-2 mb-6">
          <StartWithAiIcon />
          <span className="text-sm font-medium text-[#4B89EF]">
            Generate or fill with AI.
          </span>
        </div>

        <Textarea
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="Paste event details or a short brief here."
          className="min-h-[180px] w-full border-gray-300 rounded-xl text-sm resize-none"
        />

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setView("options")}
            className="min-w-[90px] bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Back
          </Button>
          <Button
            onClick={handleAiSubmit}
            disabled={aiLoading}
            className="min-w-[130px] bg-[#4B89EF] text-white hover:bg-[#3B79DF]"
          >
            {aiLoading ? "Working..." : "Fill with AI"}
          </Button>
        </div>
      </div>

      <PrimaryCard />
    </div>
  );

  const renderDevpostView = () => (
    <div className="flex w-full flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      {/* Left – 50% on lg, vertically centered */}
      <div className="w-full lg:w-1/2 px-8 py-8 lg:px-10 lg:py-10 flex flex-col justify-center">
        <div className="space-y-2 mb-4">
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

        <div className="flex items-center justify-end gap-3 pt-6">
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

      <PrimaryCard />
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
