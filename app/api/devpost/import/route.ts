import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const EVENT_SCRAPER_URL =
  process.env.EVENT_SCRAPER_URL || "https://event-scraper-cyu60s-projects.vercel.app";

const RequestSchema = z.object({
  eventId: z.string().min(1),
  url: z.string().url(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveSlugFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const firstLabel = u.hostname.split(".")[0] || "";
    const s = slugify(firstLabel);
    return s || undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url, eventId } = parsed.data;

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authorization: organizer of this event OR admin
    let isAllowed = false;
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleRow && typeof roleRow.role === "string") {
      isAllowed = ["organizer", "admin"].includes(roleRow.role);
    }

    if (!isAllowed) {
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      isAllowed = Boolean(isAdmin);
    }

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Call the external Event Scraper API
    const scrapeRes = await fetch(`${EVENT_SCRAPER_URL}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!scrapeRes.ok) {
      const errBody = await scrapeRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errBody?.error || "Failed to scrape event page" },
        { status: 502 }
      );
    }

    const result = await scrapeRes.json();
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Scraper returned no data" },
        { status: 502 }
      );
    }

    const imported = result.data as Record<string, unknown>;

    // Ensure a valid slug
    const allowed = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    let finalSlug =
      typeof imported.slug === "string" && allowed.test(imported.slug)
        ? imported.slug
        : undefined;
    if (!finalSlug && typeof imported.event_name === "string") {
      const s = slugify(imported.event_name);
      if (allowed.test(s)) finalSlug = s;
    }
    if (!finalSlug) {
      const fromUrl = deriveSlugFromUrl(url);
      if (fromUrl && allowed.test(fromUrl)) finalSlug = fromUrl;
    }
    if (finalSlug) imported.slug = finalSlug;

    return NextResponse.json({ import: imported });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/devpost/import:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
