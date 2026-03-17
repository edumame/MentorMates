"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Download, Paperclip, Globe } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

type CreateEventModalView = "options" | "ai" | "devpost" | "import";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PREFILL_STORAGE_KEY = "mentorMates-event-prefill";

// AI option icon: wand + stars (design asset), 24×24
function StartWithAiIcon() {
  return (
    <Image
      src="/img/wand_stars.svg"
      alt=""
      width={24}
      height={24}
      className="size-6 shrink-0"
    />
  );
}

// Right gradient panel – 50% on lg. Typography: Geist 72px / 600 / 90% / -4.32px, color Pattens Blue Lighter
const PrimaryCard = () => (
  <div className="relative hidden lg:block w-full lg:w-1/2 shrink-0 min-w-0 -ml-px">
    <div className="relative h-full min-h-[520px] rounded-none lg:rounded-r-3xl overflow-hidden bg-[#E0F2FE]">
      <Image
        src="/img/gradient.png"
        alt="Gradient background"
        fill
        className="object-cover object-left scale-110"
        priority
        sizes="50vw"
      />
      <div className="absolute inset-0 flex items-end justify-start p-10">
        <div
          className="font-geist font-semibold leading-[90%] tracking-[-4.32px]"
          style={{
            fontFamily: "Geist, Inter, system-ui, sans-serif",
            fontSize: "72px",
            fontWeight: 600,
            color: "var(--Color-Pattens-Blue-Lighter, #F7FAFE)",
          }}
        >
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
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  const closeModal = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setView("options");
        setAiText("");
        setDevpostUrl("");
        setImportUrl("");
        setAiLoading(false);
        setDevpostLoading(false);
        setImportLoading(false);
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

  const handleUrlImport = async () => {
    if (!importUrl.trim()) {
      toast({
        title: "Add event URL",
        description: "Paste a hackathon event link to continue.",
      });
      return;
    }
    setImportLoading(true);
    try {
      const res = await fetch("/api/events/import/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to import event");
      }
      persistPrefillAndNavigate(data?.import || {});
    } catch (error) {
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to import event.",
        variant: "destructive",
      });
    } finally {
      setImportLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VIEWS（统一宽高，切换 options / AI / DevPost 时 dialog 尺寸不变）
  // ---------------------------------------------------------------------------
  const dialogSizeClass =
    "flex w-[998px] h-[590px] flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.18)]";

  const renderOptions = () => (
    <div className={dialogSizeClass}>
      {/* Left panel – 50% on lg; padding-top & padding-left 24px per design */}
      <div className="w-full lg:w-1/2 pt-6 pl-6 pr-6 pb-6 lg:pt-6 lg:pl-6 lg:pr-6 lg:pb-12">
        <DialogTitle className="sr-only">Create event</DialogTitle>

        <h2
          className="font-geist font-semibold mb-8"
          style={{
            color: "var(--text-text-primary, #18181B)",
            fontFamily: "Geist, Inter, system-ui, sans-serif",
            fontSize: "var(--Text-Sizes-Heading-5, 28px)",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "140%",
            letterSpacing: "-1.68px",
          }}
        >
          Create new event
        </h2>

        <div className="space-y-4">
          {/* Create from scratch – 默认未选中，hover 出现蓝边+渐变 */}
          <button
            onClick={() => {
              closeModal(false);
              router.push("/events/new");
            }}
            className="group w-full rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-5 text-center transition-all hover:border-[#4B89EF] hover:bg-[linear-gradient(203deg,_#DBEAFE_13.19%,_rgba(255,255,255,0)_65.83%)]"
          >
            <div className="flex flex-col items-center gap-3">
              <Image
                src="/img/create_new_folder.svg"
                alt=""
                width={24}
                height={24}
                className="size-6 shrink-0"
              />
              <div className="space-y-1 text-center w-full">
                <p
                  className="font-geist font-semibold"
                  style={{
                    color: "var(--Color-Neutral-Darkest, #000)",
                    fontFamily: "Geist, Inter, system-ui, sans-serif",
                    fontSize: "20px",
                    fontStyle: "normal",
                    fontWeight: 600,
                    lineHeight: "150%",
                    letterSpacing: "-0.8px",
                  }}
                >
                  Create from scratch
                </p>
                <p
                  className="font-inter font-normal text-center"
                  style={{
                    color: "var(--Opacity-Neutral-Darkest-60, rgba(0, 0, 0, 0.60))",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: "var(--Text-Sizes-Text-Regular, 16px)",
                    fontStyle: "normal",
                    fontWeight: 400,
                    lineHeight: "150%",
                  }}
                >
                  Create event as you wish
                </p>
              </div>
            </div>
          </button>

          {/* Start with AI */}
          <button
            onClick={() => setView("ai")}
            className="group w-full rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-5 text-center transition-all hover:border-[#4B89EF] hover:bg-[linear-gradient(203deg,_#DBEAFE_13.19%,_rgba(255,255,255,0)_65.83%)]"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="size-6 shrink-0 flex items-center justify-center">
                <StartWithAiIcon />
              </span>
              <div className="space-y-1 text-center w-full">
                <p
                  className="font-geist font-semibold"
                  style={{
                    color: "var(--Color-Neutral-Darkest, #000)",
                    fontFamily: "Geist, Inter, system-ui, sans-serif",
                    fontSize: "20px",
                    fontStyle: "normal",
                    fontWeight: 600,
                    lineHeight: "150%",
                    letterSpacing: "-0.8px",
                  }}
                >
                  Start with AI
                </p>
                <p
                  className="font-inter font-normal text-center"
                  style={{
                    color: "var(--Opacity-Neutral-Darkest-60, rgba(0, 0, 0, 0.60))",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: "var(--Text-Sizes-Text-Regular, 16px)",
                    fontStyle: "normal",
                    fontWeight: 400,
                    lineHeight: "150%",
                  }}
                >
                  Create from a prompt
                </p>
              </div>
            </div>
          </button>

          {/* Import from URL */}
          <button
            onClick={() => setView("import")}
            className="group w-full rounded-[12px] border border-[#E4E4E7] bg-white px-6 py-5 text-center transition-all hover:border-[#4B89EF] hover:bg-[linear-gradient(203deg,_#DBEAFE_13.19%,_rgba(255,255,255,0)_65.83%)]"
          >
            <div className="flex flex-col items-center gap-3">
              <Globe className="size-6 shrink-0 text-gray-500 group-hover:text-[#4B89EF]" />
              <div className="space-y-1 text-center w-full">
                <p
                  className="font-geist font-semibold"
                  style={{
                    color: "var(--Color-Neutral-Darkest, #000)",
                    fontFamily: "Geist, Inter, system-ui, sans-serif",
                    fontSize: "20px",
                    fontStyle: "normal",
                    fontWeight: 600,
                    lineHeight: "150%",
                    letterSpacing: "-0.8px",
                  }}
                >
                  Import from URL
                </p>
                <p
                  className="font-inter font-normal text-center"
                  style={{
                    color: "var(--Opacity-Neutral-Darkest-60, rgba(0, 0, 0, 0.60))",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: "var(--Text-Sizes-Text-Regular, 16px)",
                    fontStyle: "normal",
                    fontWeight: 400,
                    lineHeight: "150%",
                  }}
                >
                  Paste any event link
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
    <div className={dialogSizeClass}>
      {/* Left – 50% on lg，与 options 同 padding，标题与「Create new event」对齐 */}
      <div className="w-full lg:w-1/2 pt-6 pl-6 pr-6 pb-6 lg:pt-6 lg:pl-6 lg:pr-6 lg:pb-12 flex flex-col min-h-[520px]">
        <h2
          className="font-geist font-semibold mb-8"
          style={{
            color: "var(--text-text-primary, #18181B)",
            fontFamily: "Geist, Inter, system-ui, sans-serif",
            fontSize: "var(--Text-Sizes-Heading-5, 28px)",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "140%",
            letterSpacing: "-1.68px",
          }}
        >
          Start with AI
        </h2>

        {/* Middle: description + box centered vertically */}
        <div className="flex-1 flex items-center">
          <div className="mt-6 w-full">
            <div className="flex items-center gap-2 mb-3">
              <StartWithAiIcon />
              <span
                className="font-inter font-normal text-[#4B89EF]"
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "var(--Text-Sizes-Text-Regular, 16px)",
                  fontStyle: "normal",
                  fontWeight: 400,
                }}
              >
                Generate or fill with AI.
              </span>
            </div>
            <Textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Paste event details or a short brief here."
              className="font-inter font-normal min-h-[180px] w-full border-gray-300 rounded-xl resize-none"
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "var(--Text-Sizes-Text-Regular, 16px)",
                fontStyle: "normal",
                fontWeight: 400,
              }}
            />
          </div>
        </div>

        {/* Bottom: buttons */}
        <div className="mt-6 flex items-center justify-end gap-[6px]">
          <Button
            variant="back"
            type="button"
            onClick={() => setView("options")}
            className="min-w-[90px]"
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
    <div className={dialogSizeClass}>
      {/* Left – 与 options / AI 同 padding，标题样式一致 */}
      <div className="w-full lg:w-1/2 pt-6 pl-6 pr-6 pb-6 lg:pt-6 lg:pl-6 lg:pr-6 lg:pb-12 flex flex-col min-h-[520px]">
        <h2
          className="font-geist font-semibold mb-8"
          style={{
            color: "var(--text-text-primary, #18181B)",
            fontFamily: "Geist, Inter, system-ui, sans-serif",
            fontSize: "var(--Text-Sizes-Heading-5, 28px)",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "140%",
            letterSpacing: "-1.68px",
          }}
        >
          Import from DevPost
        </h2>

        {/* Middle: description + input centered vertically */}
        <div className="flex-1 flex items-center">
          <div className="mt-6 w-full space-y-2">
            <p className="text-sm text-gray-700">
              Paste the DevPost event link and we&apos;ll handle the rest.
            </p>

            <div className="relative mt-2">
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
            <p
              className="font-inter font-normal"
              style={{
                color: "var(--Color-Neutral, #7F7F7F)",
                fontSize: "var(--Text-Sizes-Text-Regular, 16px)",
                fontStyle: "normal",
                fontWeight: 400,
                lineHeight: "150%",
              }}
            >
              *It takes about 1–2 minutes to finish parsing. Please wait
            </p>
          </div>
        </div>

        {/* Bottom: buttons */}
        <div className="flex items-center justify-end gap-[6px] pt-6">
          <Button
            variant="back"
            type="button"
            onClick={() => setView("options")}
            className="min-w-[90px]"
          >
            Back
          </Button>
          <Button
            onClick={handleDevpostSubmit}
            disabled={devpostLoading}
            className="min-w-[120px] py-2.5 px-6"
          >
            {devpostLoading ? "Importing..." : "Create event"}
          </Button>
        </div>
      </div>

      <PrimaryCard />
    </div>
  );

  const renderImportView = () => (
    <div className={dialogSizeClass}>
      <div className="w-full lg:w-1/2 pt-6 pl-6 pr-6 pb-6 lg:pt-6 lg:pl-6 lg:pr-6 lg:pb-12 flex flex-col min-h-[520px]">
        <h2
          className="font-geist font-semibold mb-8"
          style={{
            color: "var(--text-text-primary, #18181B)",
            fontFamily: "Geist, Inter, system-ui, sans-serif",
            fontSize: "var(--Text-Sizes-Heading-5, 28px)",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "140%",
            letterSpacing: "-1.68px",
          }}
        >
          Import from URL
        </h2>

        <div className="flex-1 flex items-center">
          <div className="mt-6 w-full space-y-2">
            <p className="text-sm text-gray-700">
              Paste any event link and we&apos;ll handle the rest.
            </p>

            <div className="relative mt-2">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Globe className="h-4 w-4 text-gray-400" />
              </span>
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://..."
                className="pl-9 h-11 rounded-xl text-sm"
              />
            </div>
            <p
              className="font-inter font-normal"
              style={{
                color: "var(--Color-Neutral, #7F7F7F)",
                fontSize: "var(--Text-Sizes-Text-Regular, 16px)",
                fontStyle: "normal",
                fontWeight: 400,
                lineHeight: "150%",
              }}
            >
              *It takes about 1-2 minutes to finish parsing. Please wait.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-[6px] pt-6">
          <Button
            variant="back"
            type="button"
            onClick={() => setView("options")}
            className="min-w-[90px]"
          >
            Back
          </Button>
          <Button
            onClick={handleUrlImport}
            disabled={importLoading}
            className="min-w-[120px] py-2.5 px-6"
          >
            {importLoading ? "Importing..." : "Import event"}
          </Button>
        </div>
      </div>

      <PrimaryCard />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="w-auto max-w-[min(998px,calc(100vw-2rem))] border-none bg-transparent p-0 shadow-none [&>button]:text-white [&>button]:hover:opacity-100 [&>button]:opacity-90">
        {view === "options" && renderOptions()}
        {view === "ai" && renderAiView()}
        {view === "devpost" && renderDevpostView()}
        {view === "import" && renderImportView()}
      </DialogContent>
    </Dialog>
  );
}
