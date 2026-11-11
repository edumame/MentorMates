import { NextRequest, NextResponse } from "next/server";
import { TinyFishClient } from "@/lib/tinyfish/client";
import { scrapeEvent } from "@/lib/scraper/devpost";
import { authenticateScraper, claimScraperQuota, readScraperRequest, scraperError } from "@/lib/scraper/admission";
import { SCRAPER_TIMEOUT_MS, ScraperRequestError } from "@/lib/scraper/request";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const userId = await authenticateScraper();
    const input = await readScraperRequest(req);
    const apiKey = process.env.TINYFISH_API_KEY;
    if (!apiKey) throw new ScraperRequestError("Scraping service is not configured", 503);
    const denied = await claimScraperQuota(userId);
    if (denied) return denied;
    const client = new TinyFishClient({ apiKey, browserProfile: input.browserProfile, timeoutMs: SCRAPER_TIMEOUT_MS });
    const result = await scrapeEvent(client, input);
    if (!result.success) throw new ScraperRequestError("Could not import this event", 502);
    return NextResponse.json({ success: true, data: result.data, error: null, runId: result.runId ?? null });
  } catch (error) {
    return scraperError(error);
  }
}
