import { NextResponse } from "next/server";

const SKILL_RAW_URL =
  "https://raw.githubusercontent.com/edumame/mentormates-skill/main/skills/mentormates/SKILL.md";

// Cache the fetched skill for 1 hour. Edit the canonical skill in
// https://github.com/edumame/mentormates-skill and this endpoint picks it up
// on the next revalidation (or on-demand via revalidatePath).
export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch(SKILL_RAW_URL, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Skill source returned ${res.status}` },
        { status: 502 }
      );
    }
    const content = await res.text();
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mentormates.md"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Error fetching canonical skill:", err);
    return NextResponse.json(
      { error: "Unable to fetch skill source" },
      { status: 502 }
    );
  }
}
