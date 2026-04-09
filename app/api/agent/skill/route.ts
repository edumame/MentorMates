import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// GET: Serve the Claude Code skill file
export async function GET() {
  try {
    const skillPath = join(process.cwd(), "public", "skills", "SKILL.md");
    const content = readFileSync(skillPath, "utf-8");

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mentormates-organizer.md"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Skill file not found" },
      { status: 404 }
    );
  }
}
