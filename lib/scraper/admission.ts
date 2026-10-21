import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MAX_REQUEST_BYTES, parseScraperRequest, readBoundedJson, reserveScraperQuota, ScraperRequestError } from "./request";

export function scraperError(error: unknown) {
  return NextResponse.json({ success: false, error: error instanceof ScraperRequestError ? error.message : "Scraping service unavailable", data: null }, {
    status: error instanceof ScraperRequestError ? error.status : 502,
  });
}

export async function authenticateScraper() {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Unauthorized");
    return user.id;
  } catch {
    throw new ScraperRequestError("Authentication required", 401);
  }
}

export async function readScraperRequest(request: Request) {
  return parseScraperRequest(await readBoundedJson(request, MAX_REQUEST_BYTES), process.env.SCRAPER_ALLOWED_HOSTS);
}

export async function claimScraperQuota(userId: string) {
  let decision;
  try { decision = await reserveScraperQuota(createSupabaseServiceClient(), userId); } catch {
    throw new ScraperRequestError("Scraping is temporarily unavailable", 503);
  }
  if (!decision.allowed) return NextResponse.json({ success: false, error: "Import limit reached. Try again later.", data: null }, {
    status: 429, headers: { "Retry-After": String(decision.retry_after_seconds) },
  });
  return null;
}
