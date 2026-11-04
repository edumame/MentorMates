/**
 * Import a Luma event for the creation chat.
 *
 * Luma pages are client-rendered, so the general scraper (TinyFish, minutes
 * per page, allowlisted hosts) is the slow way to read them. Luma's public
 * event endpoint returns the same data in one request. Only the fixed Luma
 * API host is ever fetched, with a validated slug: a pasted URL never chooses
 * where the server connects.
 */

import { utcIsoToWallTime } from "./chat-draft";

const LUMA_HOSTS =new Set(["lu.ma", "www.lu.ma", "luma.com", "www.luma.com"]);
const LUMA_SLUG = /^[A-Za-z0-9_-]{1,100}$/;
/** Luma's own app routes, which are not events. */
const LUMA_RESERVED = new Set(["discover", "home", "create", "signin", "login", "settings", "calendar", "explore", "pricing", "user", "event"]);

export const LUMA_API_URL = "https://api.lu.ma/url";
export const LUMA_TIMEOUT_MS = 10_000;
export const LUMA_MAX_BYTES = 2_000_000;

/** The event slug of a Luma event link ("https://luma.com/abc123" -> "abc123"), else null. */
export function lumaEventSlug(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!LUMA_HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const slug = parts[0];
  if (!LUMA_SLUG.test(slug) || LUMA_RESERVED.has(slug.toLowerCase())) return null;
  return slug;
}

// ---------------------------------------------------------------------------
// Luma's description is a ProseMirror document; turn it into Markdown.
// ---------------------------------------------------------------------------

interface PmNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: PmNode[];
}

function inline(nodes: PmNode[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === "hard_break") return "\n";
      if (n.type !== "text" || !n.text) return inline(n.content);
      let text = n.text;
      for (const mark of n.marks ?? []) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "link" && typeof mark.attrs?.href === "string") text = `[${text}](${mark.attrs.href})`;
      }
      return text;
    })
    .join("");
}

function block(node: PmNode, depth = 0): string {
  const children = node.content ?? [];
  switch (node.type) {
    case "doc":
      return children.map((c) => block(c, depth)).filter(Boolean).join("\n\n");
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 2), 4);
      return `${"#".repeat(level)} ${inline(children)}`;
    }
    case "bullet_list":
    case "ordered_list":
      return children
        .map((item, i) => {
          const marker = node.type === "ordered_list" ? `${i + 1}.` : "-";
          const [first, ...rest] = item.content ?? [];
          const head = first ? (first.type === "paragraph" ? inline(first.content) : block(first, depth + 1)) : "";
          const nested = rest.map((r) => block(r, depth + 1)).join("\n");
          return `${"  ".repeat(depth)}${marker} ${head}${nested ? `\n${nested}` : ""}`;
        })
        .join("\n");
    case "blockquote":
      return children.map((c) => `> ${block(c, depth)}`).join("\n");
    case "horizontal_rule":
      return "---";
    case "paragraph":
    default:
      return inline(children);
  }
}

export function prosemirrorToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  return block(doc as PmNode).replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// Response -> what the chat model needs
// ---------------------------------------------------------------------------

export interface LumaEventSummary {
  source: "luma";
  url: string;
  name?: string;
  start_at?: string;
  end_at?: string;
  timezone?: string;
  /** start_at / end_at as wall time in `timezone`, ready for the draft's start / end. */
  start_local?: string;
  end_local?: string;
  location?: string;
  description_markdown?: string;
  hosts?: string[];
  calendar?: string;
  require_approval?: boolean;
  capacity?: number;
  is_free?: boolean;
  cover_url?: string;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function summarizeLumaEvent(payload: unknown, url: string): LumaEventSummary | null {
  const data = (payload as { data?: Record<string, unknown> } | null)?.data;
  const event = data?.event as Record<string, unknown> | undefined;
  if (!data || !event || !str(event.name)) return null;

  const geo = event.geo_address_info as Record<string, unknown> | undefined;
  const ticketInfo = data.ticket_info as Record<string, unknown> | undefined;
  const ticketTypes = Array.isArray(data.ticket_types) ? (data.ticket_types as Record<string, unknown>[]) : [];
  const capacities = ticketTypes.map((t) => t.max_capacity).filter((c): c is number => typeof c === "number" && c > 0);
  const hosts = Array.isArray(data.hosts)
    ? (data.hosts as Record<string, unknown>[]).map((h) => str(h.name)).filter((h): h is string => !!h)
    : [];
  const virtual = (event.virtual_info as Record<string, unknown> | undefined)?.has_access ? "Online" : undefined;

  const timezone = str(event.timezone);
  const startAt = str(event.start_at);
  const endAt = str(event.end_at);

  return {
    source: "luma",
    url,
    name: str(event.name),
    start_at: startAt,
    end_at: endAt,
    timezone,
    start_local: (startAt && timezone && utcIsoToWallTime(startAt, timezone)) || undefined,
    end_local: (endAt && timezone && utcIsoToWallTime(endAt, timezone)) || undefined,
    location: str(geo?.full_address) ?? str(geo?.address) ?? str(geo?.city_state) ?? virtual,
    description_markdown: prosemirrorToMarkdown(data.description_mirror) || undefined,
    hosts: hosts.length > 0 ? hosts : undefined,
    calendar: str((data.calendar as Record<string, unknown> | undefined)?.name),
    require_approval: typeof ticketInfo?.require_approval === "boolean" ? ticketInfo.require_approval : undefined,
    capacity: capacities.length > 0 ? capacities.reduce((a, b) => a + b, 0) : undefined,
    is_free: typeof ticketInfo?.is_free === "boolean" ? ticketInfo.is_free : undefined,
    cover_url: str(event.cover_url),
  };
}

export class LumaImportError extends Error {}

/** Fetches and summarizes a Luma event. Throws LumaImportError with a message fit to show. */
export async function fetchLumaEvent(
  slug: string,
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<LumaEventSummary> {
  if (!LUMA_SLUG.test(slug)) throw new LumaImportError("That doesn't look like a Luma event link.");
  let res: Response;
  try {
    res = await fetchImpl(`${LUMA_API_URL}?url=${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(LUMA_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new LumaImportError("Luma didn't answer in time.");
  }
  if (res.status === 404) throw new LumaImportError("Luma couldn't find that event.");
  if (!res.ok) throw new LumaImportError("Luma couldn't share that event.");
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > LUMA_MAX_BYTES) throw new LumaImportError("That Luma page is too large to import.");
  const text = await res.text();
  if (text.length > LUMA_MAX_BYTES) throw new LumaImportError("That Luma page is too large to import.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LumaImportError("Luma sent something unexpected.");
  }
  const summary = summarizeLumaEvent(json, url);
  if (!summary) throw new LumaImportError("That Luma link isn't a public event.");
  return summary;
}
