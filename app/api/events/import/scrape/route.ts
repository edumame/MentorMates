import { NextRequest, NextResponse } from "next/server";
import { authenticateScraper, claimScraperQuota, readScraperRequest, scraperError } from "@/lib/scraper/admission";
import { MAX_RESPONSE_BYTES, SCRAPER_TIMEOUT_MS, ScraperRequestError, readBoundedJson, scraperProxyConfig } from "@/lib/scraper/request";
import { z } from "zod";

export const maxDuration = 300;
const responseSchema = z.object({ success: z.literal(true), data: z.record(z.unknown()), runId: z.string().optional().nullable() });

export async function POST(req: NextRequest) {
  try {
    const userId = await authenticateScraper();
    const input = await readScraperRequest(req);
    // This is a separate service with shared-token auth, not our cookie-auth route.
    const config = scraperProxyConfig(process.env.EVENT_SCRAPER_API_URL, process.env.EVENT_SCRAPER_API_TOKEN);
    const denied = await claimScraperQuota(userId);
    if (denied) return denied;
    const res = await fetch(config.endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(SCRAPER_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      void res.body?.cancel().catch(() => undefined);
      throw new ScraperRequestError("Scraping service unavailable", 502);
    }
    let responseBody: unknown;
    try { responseBody = await readBoundedJson(res, MAX_RESPONSE_BYTES); } catch {
      throw new ScraperRequestError("Invalid scraping service response", 502);
    }
    const parsed = responseSchema.safeParse(responseBody);
    if (!parsed.success) throw new ScraperRequestError("Invalid scraping service response", 502);
    const data = parsed.data;
    // Transform scraped data into MentorMates prefill format
    const scraped = data.data || {};

    const prefill: Record<string, unknown> = {
      event_name: scraped.event_name,
      event_date: scraped.event_date,
      location: scraped.location,
      slug: scraped.slug,
      event_description: scraped.event_description,
      event_blurb: scraped.event_blurb,
      cover_image_url: scraped.cover_image_url,
      submission_time_start: scraped.submission_time_start,
      submission_time_cutoff: scraped.submission_time_cutoff,
    };

    // Pass through complex nested structures
    if (Array.isArray(scraped.rules)) {
      prefill.rules = scraped.rules;
    }
    if (Array.isArray(scraped.faqs)) {
      prefill.faqs = scraped.faqs;
    }
    if (Array.isArray(scraped.event_resources)) {
      prefill.event_resources = scraped.event_resources;
    }
    if (Array.isArray(scraped.event_schedule) || Array.isArray(scraped.schedule)) {
      prefill.event_schedule = scraped.event_schedule || scraped.schedule;
    }
    if (Array.isArray(scraped.tracks)) {
      prefill.tracks = scraped.tracks.filter((track): track is Record<string, unknown> => typeof track === "object" && track !== null && !Array.isArray(track)).map((track) => ({
        name: track.name,
        description: track.description,
        criteria: Array.isArray(track.scoring_criteria)
          ? track.scoring_criteria
          : Array.isArray(track.criteria)
          ? track.criteria
          : [],
      }));
    }

    // Pass submission_fields if present from scraper
    if (Array.isArray(scraped.submission_fields)) {
      prefill.submission_fields = scraped.submission_fields;
    }

    return NextResponse.json({
      import: prefill,
      runId: data.runId ?? null,
    });
  } catch (error) {
    // Never expose remote body, transport details, or credentials to the client.
    return scraperError(error instanceof ScraperRequestError && [400,401,408,413,429,503].includes(error.status) ? error : new ScraperRequestError("Scraping service unavailable", 502));
  }
}
