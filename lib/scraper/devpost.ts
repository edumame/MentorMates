/**
 * Hackathon event scraper using TinyFish.
 *
 * Works on any hackathon site (DevPost, custom sites, etc.).
 * TinyFish navigates the page, extracts data, and returns it in the
 * exact format the MentorMates API expects.
 */

import { TinyFishClient } from "@/lib/tinyfish/client";
import { hackathonEventGoal } from "./goals";

export interface ScrapeOptions {
  url: string;
  browserProfile?: "lite" | "stealth";
}

export interface ScrapeResult {
  success: boolean;
  data: Record<string, unknown> | null;
  raw: unknown;
  error?: string;
  runId?: string;
  streamingUrl?: string;
}

/**
 * Derive a slug from a URL.
 * e.g., "https://stormhacks2025.devpost.com/" -> "stormhacks2025"
 * e.g., "https://hackathon.example.com/events/my-hack" -> "my-hack"
 */
function deriveSlug(url: string): string {
  const u = new URL(url);
  const hostname = u.hostname;

  if (hostname.endsWith(".devpost.com")) {
    return hostname.split(".")[0];
  }

  const pathParts = u.pathname
    .split("/")
    .filter((p) => p.length > 0);
  if (pathParts.length > 0) {
    return pathParts[pathParts.length - 1];
  }

  return hostname.split(".")[0];
}

/**
 * Extract JSON from a response that might have markdown fences or other wrapping.
 */
function extractJson(input: unknown): Record<string, unknown> | null {
  if (input == null) return null;

  // Already an object — return directly
  if (typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  if (typeof input !== "string") return null;

  let str = (input as string).trim();

  // Strip markdown code fences (including multiline)
  str = str.replace(/^```(?:json)?\s*\n?/im, "").replace(/\n?\s*```\s*$/im, "");
  str = str.trim();

  // Attempt 1: Direct parse
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // continue
  }

  // Attempt 2: Find outermost { ... } and parse
  const start = str.indexOf("{");
  const end = str.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(str.slice(start, end + 1));
      if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // continue
    }
  }

  // Attempt 3: Maybe it's double-encoded (string within a string)
  if (str.startsWith('"') && str.endsWith('"')) {
    try {
      const unescaped = JSON.parse(str);
      if (typeof unescaped === "string") {
        return extractJson(unescaped);
      }
    } catch {
      // give up
    }
  }

  console.error(
    `[extractJson] Could not parse. Input type: ${typeof input}, length: ${str.length}, preview: ${str.slice(0, 500)}`
  );
  return null;
}

/**
 * Scrape a hackathon event page using TinyFish.
 */
export async function scrapeEvent(
  client: TinyFishClient,
  options: ScrapeOptions
): Promise<ScrapeResult> {
  console.log(`\nScraping: ${options.url}`);
  console.log(`Browser:  ${options.browserProfile ?? "lite"}`);

  let result;
  try {
    result = await client.runAutomation({
      url: options.url,
      goal: hackathonEventGoal(),
      browser_profile: options.browserProfile,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[scrapeEvent] TinyFish automation threw:`, msg);
    return {
      success: false,
      data: null,
      raw: msg,
      error: `TinyFish error: ${msg}`,
    };
  }

  console.log(`[scrapeEvent] TinyFish result: success=${result.success}, runId=${result.runId}, dataType=${typeof result.data}, dataPreview=${JSON.stringify(result.data)?.slice(0, 500)}`);

  if (!result.success) {
    return {
      success: false,
      data: null,
      raw: result.data,
      error: result.error ?? "TinyFish automation failed",
      runId: result.runId,
      streamingUrl: result.streamingUrl,
    };
  }

  const data = extractJson(result.data);
  if (!data) {
    return {
      success: false,
      data: null,
      raw: result.data,
      error: "Could not parse JSON from TinyFish response",
      runId: result.runId,
      streamingUrl: result.streamingUrl,
    };
  }

  if (!data.slug) {
    data.slug = deriveSlug(options.url);
  }

  return {
    success: true,
    data,
    raw: result.data,
    runId: result.runId,
    streamingUrl: result.streamingUrl,
  };
}
