import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint that calls the event-scraper's deployed API.
 * This avoids Vercel timeout issues since event-scraper has maxDuration=300.
 *
 * POST /api/events/import/scrape
 * Body: { url: string, browserProfile?: "lite" | "stealth" }
 */

// Allow up to 5 minutes for the proxy call
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const scraperUrl = process.env.EVENT_SCRAPER_API_URL;
  if (!scraperUrl) {
    return NextResponse.json(
      { error: "EVENT_SCRAPER_API_URL not configured." },
      { status: 500 }
    );
  }

  let body: { url?: string; browserProfile?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { url, browserProfile } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Missing required field: url" },
      { status: 400 }
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: `Invalid URL: "${url}"` },
      { status: 400 }
    );
  }

  try {
    const scraperEndpoint = `${scraperUrl.replace(/\/+$/, "")}/api/scrape`;

    const res = await fetch(scraperEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        browserProfile: browserProfile || "lite",
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return NextResponse.json(
        { error: data.error || "Scraping failed" },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }

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
      prefill.tracks = scraped.tracks.map((track: Record<string, unknown>) => ({
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Scraping service error: ${message}` },
      { status: 502 }
    );
  }
}
