"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DraftNotReadyError,
  applyDraftPatch,
  browserTimeZone,
  draftToCreatePayload,
  emptyDraft,
  eventLinkToImport,
  isDraftStarted,
  type DraftPatch,
  type EventDraft,
} from "@/lib/events/chat-draft";
import { lumaEventSlug } from "@/lib/events/luma-import";
import { EventDraftCard } from "./EventDraftCard";

type MessageLine = { id: string; role: "user" | "assistant"; content: string; tone?: "error" };
export type ChatLine = MessageLine | { id: string; role: "status"; content: string };

/** Unsent work survives a reload in this tab; cleared once the event is created. */
export const CHAT_STORAGE_KEY = "mentormates-event-chat-v1";

const GREETING =
  "Paste a Luma link or the event's text, or just tell me about it. I'll draft the page and ask for anything missing.";

let lineSeq = 0;
const lineId = () => `l${Date.now().toString(36)}${(lineSeq++).toString(36)}`;

function loadSaved(): { lines: ChatLine[]; draft: EventDraft } | null {
  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { lines?: ChatLine[]; draft?: EventDraft };
    if (!Array.isArray(saved.lines) || !saved.draft) return null;
    return { lines: saved.lines.filter((l) => l.role !== "status"), draft: { ...emptyDraft(), ...saved.draft } };
  } catch {
    return null;
  }
}

function save(lines: ChatLine[], draft: EventDraft) {
  try {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ lines, draft }));
  } catch {
    // Storage can be full or blocked; the chat still works without it.
  }
}

function clearSaved() {
  try {
    window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Event creation as one chat (/events/new). The organiser pastes a link or
 * text, or describes the event; the assistant drafts it and asks for what is
 * missing, one question at a time. The draft card beside the chat (inline
 * under it on a phone) previews the page, takes click-to-edit changes, and
 * holds the one Create event.
 *
 * The look follows Habitect's chat (components/ChatHome, ChatActionDraft):
 * a quiet list, the organiser's lines in a soft pill, the assistant's in
 * plain muted text, the composer pinned at the bottom with Enter to send.
 */
export function EventCreationChat() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  /** Shows the empty card, so an event can be created without the assistant. */
  const [manual, setManual] = useState(false);
  const inFlight = useRef(false);
  const listEnd = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  // Restore an unfinished chat; a shared ?url= only fills the box, it never
  // spends an import on its own.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setLines(saved.lines);
      setDraft(saved.draft);
    }
    const shared = searchParams.get("url");
    if (shared) setText(shared);
    setRestored(true);
  }, [searchParams]);

  useEffect(() => {
    if (restored && (lines.length > 0 || isDraftStarted(draft))) save(lines, draft);
  }, [lines, draft, restored]);

  useEffect(() => {
    listEnd.current?.scrollIntoView?.({ block: "end" });
  }, [lines]);

  // The box grows with what is typed, up to a few lines.
  useLayoutEffect(() => {
    const el = composer.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const say = useCallback((line: Omit<MessageLine, "id">) => {
    const withId: ChatLine = { ...line, id: lineId() };
    setLines((prev) => [...prev.filter((l) => l.role !== "status"), withId]);
  }, []);

  const status = useCallback((content: string | null) => {
    setLines((prev) => {
      const rest = prev.filter((l) => l.role !== "status");
      return content ? [...rest, { id: lineId(), role: "status", content }] : rest;
    });
  }, []);

  /** A link that is not Luma goes through the general importer first. */
  const importWithScraper = async (url: string): Promise<string | null> => {
    status("Reading that page. This can take a minute or two…");
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, browserProfile: "lite" }),
    });
    const data = await readJson(res);
    if (!res.ok || !data.success) {
      const why = typeof data.error === "string" ? data.error : "I couldn't read that page";
      say({ role: "assistant", content: `${why.replace(/\.$/, "")}. Paste the event text here and I'll draft it from that.`, tone: "error" });
      return null;
    }
    return JSON.stringify(data.data ?? {});
  };

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setText("");
    setCreateError(null);

    const userLine: ChatLine = { id: lineId(), role: "user", content: message };
    const history = [...lines, userLine];
    setLines(history);

    try {
      const link = eventLinkToImport(message, draft);
      let context: string | null = null;
      if (link && !lumaEventSlug(link)) {
        context = await importWithScraper(link);
        if (context === null) return;
      }
      status(link ? "Drafting from the event page…" : "Drafting…");

      const res = await fetch("/api/events/chat-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            // Status lines and error notes are UI, not conversation.
            .filter((l): l is MessageLine => l.role !== "status" && !l.tone)
            .map((l) => ({ role: l.role, content: l.content })),
          draft,
          timezone: draft.timezone || browserTimeZone(),
          context,
        }),
      });
      const data = await readJson(res);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const unavailable = res.status === 429 || res.status >= 500;
        if (unavailable) setManual(true);
        const why = typeof data.error === "string" ? data.error : "Something went wrong. Try again.";
        say({
          role: "assistant",
          content: unavailable ? `${why} You can fill in the draft by hand.` : why,
          tone: "error",
        });
        return;
      }
      if (data.draft && typeof data.draft === "object") setDraft(data.draft as EventDraft);
      say({ role: "assistant", content: typeof data.reply === "string" ? data.reply : "" });
    } catch {
      setManual(true);
      say({ role: "assistant", content: "I couldn't reach the server. Check your connection and try again, or fill in the draft by hand.", tone: "error" });
    } finally {
      status(null);
      inFlight.current = false;
      setBusy(false);
      composer.current?.focus();
    }
  };

  const onPatch = (patch: DraftPatch) => {
    setCreateError(null);
    setDraft((d) => applyDraftPatch(d, patch));
  };

  const create = async () => {
    if (creating || inFlight.current) return;
    setCreateError(null);
    let payload;
    try {
      payload = draftToCreatePayload(draft);
    } catch (error) {
      setCreateError(error instanceof DraftNotReadyError ? error.message : "The draft isn't ready yet.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const message = typeof data.error === "string" ? data.error : "Couldn't create the event.";
        setCreateError(message);
        if (/slug/i.test(message)) {
          say({ role: "assistant", content: "That URL is taken. Click it on the card to change it, or tell me a new slug." });
        }
        return;
      }
      const created = data.event as { event_id: string; slug?: string | null } | undefined;
      clearSaved();
      router.push(`/events/${created?.slug || created?.event_id}/overview`);
    } catch {
      setCreateError("Couldn't reach the server. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const startOver = () => {
    if (busy || creating) return;
    clearSaved();
    setLines([]);
    setDraft(emptyDraft());
    setManual(false);
    setCreateError(null);
    composer.current?.focus();
  };

  const started = isDraftStarted(draft);
  const showCard = started || manual;
  // Locked during a turn: the reply replaces the whole draft, so an edit made
  // meanwhile would be lost.
  const card = (
    <fieldset disabled={busy} className="contents">
      <EventDraftCard draft={draft} onPatch={onPatch} onCreate={create} creating={creating} error={createError} />
    </fieldset>
  );

  return (
    <div className="flex min-h-0 flex-1 bg-white">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-6 px-4 lg:px-6">
        {/* The chat: messages scroll, the composer stays at the bottom. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 pb-2 pt-4 lg:pt-6">
            <h1 className="text-[15px] font-semibold text-black">Create an event</h1>
            {lines.length > 0 || showCard ? (
              <button
                type="button"
                onClick={startOver}
                disabled={busy || creating}
                className="text-[12px] text-muted-foreground hover:text-black disabled:opacity-40"
              >
                Start over
              </button>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4" aria-live="polite">
            <ol className="flex flex-col gap-3 text-[14px] leading-6">
              <li className="text-muted-foreground">{GREETING}</li>
              {lines.map((line) =>
                line.role === "user" ? (
                  <li key={line.id} className="flex justify-end">
                    <p className="max-h-60 max-w-[85%] overflow-y-auto whitespace-pre-wrap break-words rounded-[12px] bg-[#4B89EF]/10 px-3 py-1.5 text-black">
                      {line.content}
                    </p>
                  </li>
                ) : line.role === "status" ? (
                  <li key={line.id} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                    {line.content}
                  </li>
                ) : (
                  <li
                    key={line.id}
                    className={cn(
                      "whitespace-pre-wrap break-words",
                      line.tone === "error" ? "text-red-600/90" : "text-muted-foreground"
                    )}
                  >
                    {line.content}
                  </li>
                )
              )}
            </ol>
            {/* On a phone the draft sits inline, under the latest reply. */}
            {showCard ? <div className="mt-4 lg:hidden">{card}</div> : null}
            <div ref={listEnd} />
          </div>

          <form
            className="pb-4 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <div className="flex items-end gap-2 rounded-[18px] border border-[rgba(0,0,0,0.12)] bg-white py-1.5 pl-3.5 pr-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_20px_rgba(0,0,0,0.05)] focus-within:border-[rgba(0,0,0,0.25)]">
              <textarea
                ref={composer}
                aria-label="Message"
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                placeholder={started ? "Ask for a change, e.g. “make it 4pm”" : "Paste a Luma link or event text…"}
                className="max-h-[200px] min-h-[24px] flex-1 resize-none self-center bg-transparent py-1 text-[14px] leading-6 text-black outline-none placeholder:text-muted-foreground/70"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={busy || !text.trim()}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-[#4B89EF] text-white transition-colors hover:bg-[#3E7EEA] disabled:opacity-30"
              >
                {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowUp aria-hidden className="size-4" />}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              Enter to send, Shift+Enter for a new line.{" "}
              {showCard ? null : (
                <>
                  <button type="button" onClick={() => setManual(true)} className="hover:text-black hover:underline">
                    Fill it in by hand
                  </button>
                  {" · "}
                </>
              )}
              <Link href="/events/submit" className="hover:text-black hover:underline">
                Hosting elsewhere? List an external event
              </Link>
            </p>
          </form>
        </div>

        {/* Desktop: the draft beside the chat. */}
        <aside className="hidden w-[380px] shrink-0 overflow-y-auto pb-6 pt-14 lg:block">
          {showCard ? (
            card
          ) : (
            <div className="rounded-[12px] border border-dashed border-[rgba(0,0,0,0.12)] p-4 text-[13px] text-muted-foreground">
              Your event&apos;s preview shows up here as the chat drafts it.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
