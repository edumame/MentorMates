import { NextRequest, NextResponse } from "next/server";
import { TinyFishClient } from "@/lib/tinyfish/client";
import { scrapeEvent } from "@/lib/scraper/devpost";

// Allow up to 5 minutes for scraping (requires Vercel Pro for > 60s)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TINYFISH_API_KEY not configured on the server." },
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

  const profile =
    browserProfile === "stealth" ? "stealth" : ("lite" as const);

  const client = new TinyFishClient({
    apiKey,
    browserProfile: profile,
  });

  try {
    const result = await scrapeEvent(client, { url, browserProfile: profile });

    // Include raw preview for debugging
    let rawPreview: string | null = null;
    try {
      if (result.raw != null) {
        rawPreview = typeof result.raw === "string"
          ? result.raw.slice(0, 3000)
          : JSON.stringify(result.raw).slice(0, 3000);
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error ?? null,
      runId: result.runId ?? null,
      rawPreview: result.success ? undefined : rawPreview,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message, data: null },
      { status: 500 }
    );
  }
}
