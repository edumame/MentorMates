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
import React from "react";

// Inline the new StartWithAiIcon SVG
function StartWithAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={19}
      height={19}
      viewBox="0 0 19 19"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M13.3613 10.1623L11.0265 13.9271C10.8932 14.1477 10.7047 14.2331 10.461 14.1831C10.2173 14.1331 10.0622 13.9894 9.9955 13.7521L9.1765 10.4448L1.61625 17.9683C1.44625 18.1421 1.24733 18.2291 1.0195 18.2291C0.791666 18.2291 0.59275 18.1421 0.42275 17.9683C0.252917 17.7983 0.168 17.5994 0.168 17.3716C0.168 17.1437 0.252917 16.9448 0.42275 16.7748L7.958 9.24556L4.639 8.42631C4.40167 8.35964 4.259 8.20456 4.211 7.96106C4.163 7.71739 4.24733 7.52689 4.464 7.38956L8.22875 5.02981L7.92275 0.628059C7.90608 0.374059 8.01125 0.188726 8.23825 0.0720588C8.46525 -0.0446078 8.67242 -0.0196078 8.85975 0.147059L12.2375 2.98781L16.333 1.34606C16.5663 1.26272 16.7683 1.30639 16.939 1.47706C17.1097 1.64773 17.1533 1.84973 17.07 2.08306L15.4033 6.17856L18.244 9.56231C18.4107 9.74964 18.4398 9.95681 18.3315 10.1838C18.2232 10.4108 18.042 10.516 17.788 10.4993L13.3613 10.1623ZM0.137 3.43956C0.0456666 3.35223 0 3.24956 0 3.13156C0 3.01373 0.0456666 2.90914 0.137 2.81781L1.35875 1.59606C1.44608 1.50872 1.54867 1.46506 1.6665 1.46506C1.7845 1.46506 1.88917 1.50872 1.9805 1.59606L3.17125 2.79281C3.26242 2.88414 3.308 2.98773 3.308 3.10356C3.308 3.21956 3.26242 3.32323 3.17125 3.41456L1.9495 4.63631C1.85817 4.72748 1.7545 4.77306 1.6385 4.77306C1.52267 4.77306 1.41908 4.72748 1.32775 4.63631L0.137 3.43956ZM10.9625 10.9771L12.5015 8.49881L15.4238 8.71781L13.5218 6.47756L14.6228 3.77431L11.9195 4.86931L9.67325 2.96731L9.89825 5.88956L7.414 7.44756L10.2612 8.15481L10.9625 10.9771ZM15.0015 18.2791L13.7797 17.0633C13.6886 16.972 13.6472 16.8684 13.6555 16.7526C13.6638 16.6366 13.7136 16.5329 13.8048 16.4416L15.0015 15.2508C15.0888 15.1595 15.1915 15.1138 15.3095 15.1138C15.4273 15.1138 15.5319 15.1595 15.6233 15.2508L16.845 16.4666C16.9323 16.5579 16.9718 16.6616 16.9635 16.7776C16.9552 16.8934 16.9073 16.997 16.82 17.0883L15.6233 18.2791C15.5319 18.3704 15.4283 18.4161 15.3125 18.4161C15.1965 18.4161 15.0928 18.3704 15.0015 18.2791Z"
        fill="black"
      />
      <path
        d="M13.3613 10.1623L11.0265 13.9271C10.8932 14.1477 10.7047 14.2331 10.461 14.1831C10.2173 14.1331 10.0622 13.9894 9.9955 13.7521L9.1765 10.4448L1.61625 17.9683C1.44625 18.1421 1.24733 18.2291 1.0195 18.2291C0.791666 18.2291 0.59275 18.1421 0.42275 17.9683C0.252917 17.7983 0.168 17.5994 0.168 17.3716C0.168 17.1437 0.252917 16.9448 0.42275 16.7748L7.958 9.24556L4.639 8.42631C4.40167 8.35964 4.259 8.20456 4.211 7.96106C4.163 7.71739 4.24733 7.52689 4.464 7.38956L8.22875 5.02981L7.92275 0.628059C7.90608 0.374059 8.01125 0.188726 8.23825 0.0720588C8.46525 -0.0446078 8.67242 -0.0196078 8.85975 0.147059L12.2375 2.98781L16.333 1.34606C16.5663 1.26272 16.7683 1.30639 16.939 1.47706C17.1097 1.64773 17.1533 1.84973 17.07 2.08306L15.4033 6.17856L18.244 9.56231C18.4107 9.74964 18.4398 9.95681 18.3315 10.1838C18.2232 10.4108 18.042 10.516 17.788 10.4993L13.3613 10.1623ZM0.137 3.43956C0.0456666 3.35223 0 3.24956 0 3.13156C0 3.01373 0.0456666 2.90914 0.137 2.81781L1.35875 1.59606C1.44608 1.50872 1.54867 1.46506 1.6665 1.46506C1.7845 1.46506 1.88917 1.50872 1.9805 1.59606L3.17125 2.79281C3.26242 2.88414 3.308 2.98773 3.308 3.10356C3.308 3.21956 3.26242 3.32323 3.17125 3.41456L1.9495 4.63631C1.85817 4.72748 1.7545 4.77306 1.6385 4.77306C1.52267 4.77306 1.41908 4.72748 1.32775 4.63631L0.137 3.43956ZM10.9625 10.9771L12.5015 8.49881L15.4238 8.71781L13.5218 6.47756L14.6228 3.77431L11.9195 4.86931L9.67325 2.96731L9.89825 5.88956L7.414 7.44756L10.2612 8.15481L10.9625 10.9771ZM15.0015 18.2791L13.7797 17.0633C13.6886 16.972 13.6472 16.8684 13.6555 16.7526C13.6638 16.6366 13.7136 16.5329 13.8048 16.4416L15.0015 15.2508C15.0888 15.1595 15.1915 15.1138 15.3095 15.1138C15.4273 15.1138 15.5319 15.1595 15.6233 15.2508L16.845 16.4666C16.9323 16.5579 16.9718 16.6616 16.9635 16.7776C16.9552 16.8934 16.9073 16.997 16.82 17.0883L15.6233 18.2791C15.5319 18.3704 15.4283 18.4161 15.3125 18.4161C15.1965 18.4161 15.0928 18.3704 15.0015 18.2791Z"
        fill="url(#paint0_linear_2404_6921)"
      />
      <path
        d="M13.3613 10.1623L11.0265 13.9271C10.8932 14.1477 10.7047 14.2331 10.461 14.1831C10.2173 14.1331 10.0622 13.9894 9.9955 13.7521L9.1765 10.4448L1.61625 17.9683C1.44625 18.1421 1.24733 18.2291 1.0195 18.2291C0.791666 18.2291 0.59275 18.1421 0.42275 17.9683C0.252917 17.7983 0.168 17.5994 0.168 17.3716C0.168 17.1437 0.252917 16.9448 0.42275 16.7748L7.958 9.24556L4.639 8.42631C4.40167 8.35964 4.259 8.20456 4.211 7.96106C4.163 7.71739 4.24733 7.52689 4.464 7.38956L8.22875 5.02981L7.92275 0.628059C7.90608 0.374059 8.01125 0.188726 8.23825 0.0720588C8.46525 -0.0446078 8.67242 -0.0196078 8.85975 0.147059L12.2375 2.98781L16.333 1.34606C16.5663 1.26272 16.7683 1.30639 16.939 1.47706C17.1097 1.64773 17.1533 1.84973 17.07 2.08306L15.4033 6.17856L18.244 9.56231C18.4107 9.74964 18.4398 9.95681 18.3315 10.1838C18.2232 10.4108 18.042 10.516 17.788 10.4993L13.3613 10.1623ZM0.137 3.43956C0.0456666 3.35223 0 3.24956 0 3.13156C0 3.01373 0.0456666 2.90914 0.137 2.81781L1.35875 1.59606C1.44608 1.50872 1.54867 1.46506 1.6665 1.46506C1.7845 1.46506 1.88917 1.50872 1.9805 1.59606L3.17125 2.79281C3.26242 2.88414 3.308 2.98773 3.308 3.10356C3.308 3.21956 3.26242 3.32323 3.17125 3.41456L1.9495 4.63631C1.85817 4.72748 1.7545 4.77306 1.6385 4.77306C1.52267 4.77306 1.41908 4.72748 1.32775 4.63631L0.137 3.43956ZM10.9625 10.9771L12.5015 8.49881L15.4238 8.71781L13.5218 6.47756L14.6228 3.77431L11.9195 4.86931L9.67325 2.96731L9.89825 5.88956L7.414 7.44756L10.2612 8.15481L10.9625 10.9771ZM15.0015 18.2791L13.7797 17.0633C13.6886 16.972 13.6472 16.8684 13.6555 16.7526C13.6638 16.6366 13.7136 16.5329 13.8048 16.4416L15.0015 15.2508C15.0888 15.1595 15.1915 15.1138 15.3095 15.1138C15.4273 15.1138 15.5319 15.1595 15.6233 15.2508L16.845 16.4666C16.9323 16.5579 16.9718 16.6616 16.9635 16.7776C16.9552 16.8934 16.9073 16.997 16.82 17.0883L15.6233 18.2791C15.5319 18.3704 15.4283 18.4161 15.3125 18.4161C15.1965 18.4161 15.0928 18.3704 15.0015 18.2791Z"
        fill="url(#paint1_linear_2404_6921)"
      />
      <defs>
        <linearGradient
          id="paint0_linear_2404_6921"
          x1="0"
          y1="9.20803"
          x2="18.3955"
          y2="9.20803"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2DC7FA" />
          <stop offset="1" stopColor="#058E5C" />
        </linearGradient>
        <linearGradient
          id="paint1_linear_2404_6921"
          x1="0"
          y1="9.20803"
          x2="18.3955"
          y2="9.20803"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A514FA" />
          <stop offset="1" stopColor="#49C8F2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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
        <div className="text-white text-5xl font-extrabold tracking-wide leading-tight">
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
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl group-hover:bg-white group-hover:border group-hover:border-[#4B89EF]">
                <StartWithAiIcon className="h-5 w-5" />
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
              {/* Use the same ring behavior as others: just a single ring-1 on hover */}
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
            <StartWithAiIcon className="h-4 w-4" />
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
              {!aiLoading && <StartWithAiIcon className="h-4 w-4" />}
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
