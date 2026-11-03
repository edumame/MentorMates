"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CalendarPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FIELD_LABELS,
  formatWallTime,
  missingRequired,
  sanitizeDraftPatch,
  slugify,
  zoneLabel,
  type DraftPatch,
  type EventDraft,
} from "@/lib/events/chat-draft";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins, markdownRemarkPlugins } from "@/components/markdown/plugins";
import { InlineText } from "./InlineText";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-2 text-[13px] leading-5">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * The event as the chat has drafted it so far: what the page will say, its
 * URL, and one Create event. Every value is clickable to change in place;
 * bigger changes go through the chat. Ported from Habitect's chat draft card
 * (components/ChatActionDraft.tsx): a small tinted kind line, the title under
 * it, quiet rows, one full-width solid action.
 */
export function EventDraftCard({
  draft,
  onPatch,
  onCreate,
  creating,
  error,
  className,
}: {
  draft: EventDraft;
  onPatch: (patch: DraftPatch) => void;
  onCreate: () => void;
  creating: boolean;
  error?: string | null;
  className?: string;
}) {
  const [host, setHost] = useState("mentormates.ai");
  const [showFullDescription, setShowFullDescription] = useState(false);
  /** The description being edited, or null when it shows as rendered Markdown. */
  const [descriptionText, setDescriptionText] = useState<string | null>(null);
  const editingDescription = descriptionText !== null;
  const commitDescription = () => {
    if (descriptionText === null) return;
    setDescriptionText(null);
    if (descriptionText !== draft.event_description) edit({ event_description: descriptionText });
  };
  useEffect(() => {
    setHost(window.location.host.replace(/^www\./, ""));
  }, []);

  /** Inline edits go through the same sanitizer as the chat's patches. */
  const edit = (raw: Record<string, unknown>) => {
    const patch = sanitizeDraftPatch(raw);
    if (Object.keys(patch).length > 0) onPatch(patch);
  };

  const missing = missingRequired(draft);
  const tz = draft.timezone;
  const sameDay = draft.start.slice(0, 10) === draft.end.slice(0, 10);
  const slug = draft.slug || slugify(draft.event_name);

  return (
    <section
      aria-label="Event draft"
      className={cn(
        "flex flex-col gap-2.5 rounded-[12px] border border-[rgba(0,0,0,0.1)] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="grid size-5 shrink-0 place-items-center rounded-[6px] border border-[#4B89EF]/25 bg-[#4B89EF]/10">
            <CalendarPlus aria-hidden className="size-3 text-[#4B89EF]" />
          </span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-[#4B89EF]">
            Event draft
          </span>
        </span>
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {missing.length > 0 ? `Needs ${missing.map((f) => FIELD_LABELS[f]).join(", ")}` : "Ready"}
        </span>
      </div>

      <InlineText
        label="event name"
        value={draft.event_name}
        placeholder="Untitled event"
        onCommit={(v) => edit({ event_name: v })}
        className="text-[15px] font-semibold leading-snug text-black"
      />

      <div className="flex flex-col gap-1.5">
        <Row label="URL">
          <InlineText
            label="URL slug"
            value={slug}
            prefix={`${host}/events/`}
            placeholder="your-event"
            onCommit={(v) => edit({ slug: v })}
            display={
              <span className="break-all">
                <span className="text-muted-foreground">{host}/events/</span>
                <span className={slug ? "text-black" : "text-muted-foreground/70"}>{slug || "your-event"}</span>
              </span>
            }
          />
        </Row>
        <Row label="When">
          <span className="flex flex-wrap items-baseline gap-x-1">
            <InlineText
              label="start"
              type="datetime-local"
              value={draft.start}
              placeholder="Add a date"
              onCommit={(v) => edit({ start: v })}
              display={draft.start ? formatWallTime(draft.start, tz) : undefined}
            />
            {draft.start ? (
              <>
                <span className="text-muted-foreground">–</span>
                <InlineText
                  label="end"
                  type="datetime-local"
                  value={draft.end}
                  placeholder="end"
                  onCommit={(v) => edit({ end: v })}
                  display={draft.end ? formatWallTime(draft.end, tz, sameDay) : undefined}
                />
                <InlineText
                  label="time zone"
                  value={tz}
                  onCommit={(v) => edit({ timezone: v })}
                  display={<span className="text-muted-foreground">{zoneLabel(tz, draft.start)}</span>}
                />
              </>
            ) : null}
          </span>
        </Row>
        <Row label="Where">
          <InlineText label="location" value={draft.location} placeholder="Add a location" onCommit={(v) => edit({ location: v })} />
        </Row>
        <Row label="Hosts">
          <InlineText label="hosts" value={draft.hosts} placeholder="Add hosts" onCommit={(v) => edit({ hosts: v })} />
        </Row>
        <Row label="Sign-ups">
          <button
            type="button"
            aria-label="Toggle approval"
            title="Click to change"
            onClick={() => edit({ require_participant_approval: !draft.require_participant_approval })}
            className={cn(
              "-mx-1 rounded-md px-1 text-left hover:bg-black/[0.04]",
              draft.require_participant_approval === null && "text-muted-foreground/70"
            )}
          >
            {draft.require_participant_approval === null
              ? "Approval not set"
              : draft.require_participant_approval
                ? "Approval required"
                : "Open, no approval"}
          </button>
        </Row>
        <Row label="Capacity">
          <InlineText
            label="capacity"
            type="number"
            value={typeof draft.participant_capacity === "number" ? String(draft.participant_capacity) : ""}
            placeholder={draft.participant_capacity === "unlimited" ? "No cap" : "Not set"}
            onCommit={(v) => edit({ participant_capacity: v.trim() ? Number(v) : "unlimited" })}
          />
        </Row>
      </div>

      <div className="border-t border-[rgba(0,0,0,0.06)] pt-2">
        <InlineText
          label="blurb"
          multiline
          value={draft.event_blurb}
          placeholder="Add a one-line blurb"
          onCommit={(v) => edit({ event_blurb: v })}
          className="text-[13px] leading-5 text-black/80"
        />
      </div>

      {draft.schedule.length > 0 ? (
        <div className="flex flex-col gap-1 text-[13px] leading-5">
          {draft.schedule.map((day, d) => (
            <div key={`${day.day}-${d}`}>
              <p className="font-medium text-black/80">{day.day}</p>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {day.items.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="flex justify-between gap-3">
                    <span className="min-w-0 text-black/80">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground">{item.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {draft.event_description ? (
        <div className="border-t border-[rgba(0,0,0,0.06)] pt-2">
          {editingDescription ? (
            <textarea
              aria-label="description"
              autoFocus
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              onBlur={commitDescription}
              onKeyDown={(e) => {
                if (e.key === "Escape") setDescriptionText(null);
              }}
              className="min-h-[14rem] w-full rounded-md border border-[rgba(0,0,0,0.15)] bg-white px-1.5 py-1 font-mono text-[12px] leading-5 outline-none focus:border-[#4B89EF]"
            />
          ) : (
            <div
              className={cn(
                "prose prose-sm max-w-none text-[13px] text-black/80 prose-headings:mb-1 prose-headings:mt-2 prose-headings:text-[14px] prose-p:my-1 prose-ul:my-1",
                !showFullDescription && "max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]"
              )}
            >
              <ReactMarkdown
                remarkPlugins={markdownRemarkPlugins}
                rehypePlugins={markdownRehypePlugins}
                components={customMarkdownComponents}
              >
                {draft.event_description}
              </ReactMarkdown>
            </div>
          )}
          <span className="mt-1 flex gap-3 text-[12px] text-muted-foreground">
            {!editingDescription ? (
              <button type="button" onClick={() => setShowFullDescription((s) => !s)} className="hover:text-black">
                {showFullDescription ? "Show less" : "Show all"}
              </button>
            ) : null}
            <button
              type="button"
              // Keep focus in the box so Done commits once, not blur and then click.
              onMouseDown={(e) => editingDescription && e.preventDefault()}
              onClick={() => (editingDescription ? commitDescription() : setDescriptionText(draft.event_description))}
              className="hover:text-black"
            >
              {editingDescription ? "Done" : "Edit description"}
            </button>
          </span>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onCreate}
        disabled={creating || missing.length > 0}
        className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#4B89EF] px-3 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#3E7EEA] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {creating ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <CalendarPlus aria-hidden className="size-4" />}
        {creating ? "Creating…" : "Create event"}
      </button>
      <p className="-mt-1 text-center text-[11px] text-muted-foreground">
        Saved as a draft. Publish it from the event page.
      </p>
    </section>
  );
}
