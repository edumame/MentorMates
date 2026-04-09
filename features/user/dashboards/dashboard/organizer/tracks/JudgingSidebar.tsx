"use client";

/**
 * Right sidebar for the Tracks & Judging tab.
 *
 * 1. Upload rubric/criteria doc (CSV, TXT, PDF, DOC → AI parses into tracks)
 * 2. Judging Assistant chat (natural language → mutate scoring config)
 *
 * Ported from the event-scraper app.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, FileText, Sparkles, SendHorizonal } from "lucide-react";
import type { EventScoringConfig, ScoringCriterion } from "@/lib/types";

// ── Chat message type ─────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  text: 'I can help you set up judging tracks and criteria. Try:\n\n• "Add a Best Design track with UI/UX criteria"\n• "Set all weights to equal"\n• "Add a $1000 first prize to the main track"\n• "Change scoring to 1-5 scale"\n\nYou can also upload a rubric doc, PDF, or CSV to auto-populate tracks.',
};

// ── Props ─────────────────────────────────────────────────────────────

interface JudgingSidebarProps {
  config: EventScoringConfig;
  onConfigChange: (config: EventScoringConfig) => void;
  eventId: string;
}

// ── Component ─────────────────────────────────────────────────────────

export function JudgingSidebar({
  config,
  onConfigChange,
  eventId,
}: JudgingSidebarProps) {
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    INITIAL_MESSAGE,
  ]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const isInitialMount = useRef(true);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages]);

  // ── Chat submit ─────────────────────────────────────────────────────

  const handleChatSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = chatInput.trim();
      if (!text || chatLoading) return;

      setChatInput("");
      setChatMessages((prev) => [...prev, { role: "user", text }]);
      setChatLoading(true);

      try {
        const res = await fetch("/api/events/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            config,
            history: chatMessages.slice(-10), // last 10 messages for context
            context: "judging",
            eventId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: data.error || "Something went wrong.",
            },
          ]);
          return;
        }

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.reply },
        ]);

        // Apply config patch if the AI returned one
        if (data.patch && typeof data.patch === "object" && data.patch.tracks) {
          onConfigChange({ ...config, ...data.patch });
        }
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Network error. Please try again." },
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatInput, chatLoading, chatMessages, config, onConfigChange, eventId]
  );

  // ── File upload ─────────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      setFileUploading(true);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: `Uploading "${file.name}" to parse tracks and criteria...`,
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("eventId", eventId);

        const res = await fetch("/api/events/ai-chat/parse-file", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: data.error || "Failed to parse file.",
            },
          ]);
          return;
        }

        if (data.config) {
          onConfigChange(data.config);
          const trackNames = Object.values(
            (data.config as EventScoringConfig).tracks
          )
            .map((t) => t.name)
            .join(", ");
          const totalCriteria = Object.values(
            (data.config as EventScoringConfig).tracks
          ).reduce((sum, t) => sum + t.criteria.length, 0);

          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `Parsed ${Object.keys((data.config as EventScoringConfig).tracks).length} track(s) with ${totalCriteria} total criteria from "${file.name}".\n\nTracks: ${trackNames}\n\nYou can edit them in the panel on the left.`,
            },
          ]);
        } else {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "No tracks or criteria found in the file. Try a different document.",
            },
          ]);
        }
      } catch {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Failed to upload file. Please try again.",
          },
        ]);
      } finally {
        setFileUploading(false);
      }
    },
    [eventId, onConfigChange]
  );

  return (
    <div className="w-[340px] shrink-0 space-y-4 hidden lg:block">
      {/* Upload rubric doc */}
      <div
        onClick={() => !fileUploading && fileInputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-[#4B89EF]/30 bg-[#4B89EF]/5 hover:border-[#4B89EF]/50 hover:bg-[#4B89EF]/10 transition-colors p-5 text-center"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.md,.doc,.docx,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />
        {fileUploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4b89ef] border-t-transparent" />
            <p className="text-sm font-medium text-[#4b89ef]">
              Parsing document...
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Upload className="h-5 w-5 text-[#4b89ef]" />
              <FileText className="h-5 w-5 text-[#4b89ef]" />
            </div>
            <p className="text-sm font-medium text-gray-700">
              Upload rubric or criteria doc
            </p>
            <p className="text-xs text-gray-500 mt-1">
              CSV, TXT, PDF, DOC — we&apos;ll parse tracks &amp; criteria
              automatically
            </p>
          </>
        )}
      </div>

      {/* Judging Assistant Chat */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col h-[480px]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-[#4B89EF]/5 to-[#6B9FEF]/5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#4B89EF] to-[#6B9FEF] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-black">
                Judging Assistant
              </p>
              <p className="text-xs text-gray-500">AI-powered track builder</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[#4b89ef] text-white rounded-br-sm"
                    : "bg-gray-100 text-black rounded-bl-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {(chatLoading || fileUploading) && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm text-gray-400">
                <span className="inline-flex gap-1">
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  >
                    .
                  </span>
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  >
                    .
                  </span>
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  >
                    .
                  </span>
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-3 py-3">
          <form
            onSubmit={handleChatSubmit}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask me to set up tracks..."
              disabled={chatLoading || fileUploading}
              className="flex-1 h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#4b89ef] focus:bg-white focus:ring-1 focus:ring-[#4b89ef] transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading || fileUploading}
              className="h-10 w-10 rounded-xl bg-[#4b89ef] text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-[#3d75d9] transition-colors"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
