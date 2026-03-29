import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

// GET: List judges and their scoring progress
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participants:read");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const supabase = createSupabaseServiceClient();

    // Get judges
    const { data: judges, error } = await supabase
      .from("user_event_roles")
      .select(
        `
        user_id, role, created_at,
        user_profiles!user_event_roles_user_id_fkey1(
          uid, display_name, email, avatar_url
        )
      `
      )
      .eq("event_id", auth.eventId)
      .eq("role", "judge");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch judges" },
        { status: 500 }
      );
    }

    // Get project count and scores per judge
    const { count: totalProjects } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("event_id", auth.eventId);

    const judgeIds = judges?.map((j) => j.user_id) || [];
    let scoreCounts: { judge_id: string }[] = [];

    if (judgeIds.length > 0) {
      const { data: scores } = await supabase
        .from("project_scores")
        .select("judge_id")
        .eq("event_id", auth.eventId)
        .in("judge_id", judgeIds);

      scoreCounts = scores || [];
    }

    const judgesWithProgress = judges?.map((judge) => ({
      ...judge,
      projects_scored: scoreCounts.filter(
        (s) => s.judge_id === judge.user_id
      ).length,
      total_projects: totalProjects || 0,
    }));

    return NextResponse.json({ judges: judgesWithProgress });
  } catch (error) {
    console.error("Agent judges GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const sendInfoSchema = z.object({
  judge_ids: z.array(z.string().uuid()).optional(), // if omitted, send to all
  message: z.string().max(2000),
  subject: z.string().max(200).optional().default("Event Update"),
});

// POST: Send info/email to judges
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participants:write");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const body = await request.json();
    const parsed = sendInfoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { judge_ids, message, subject } = parsed.data;
    const supabase = createSupabaseServiceClient();

    // Get judge emails
    let query = supabase
      .from("user_event_roles")
      .select(
        `
        user_id,
        user_profiles!user_event_roles_user_id_fkey1(
          email, display_name
        )
      `
      )
      .eq("event_id", auth.eventId)
      .eq("role", "judge");

    if (judge_ids && judge_ids.length > 0) {
      query = query.in("user_id", judge_ids);
    }

    const { data: judges, error } = await query;

    if (error || !judges?.length) {
      return NextResponse.json(
        { error: "No judges found" },
        { status: 404 }
      );
    }

    // Get event name for the email
    const { data: event } = await supabase
      .from("events")
      .select("event_name")
      .eq("event_id", auth.eventId)
      .single();

    // Send emails via the internal email API
    const results = await Promise.allSettled(
      judges.map(async (judge) => {
        const profile = judge.user_profiles as unknown as {
          email: string;
          display_name: string;
        };
        if (!profile?.email) return { skipped: true, user_id: judge.user_id };

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: profile.email,
              subject: `[${event?.event_name || "MentorMates"}] ${subject}`,
              html: `<p>Hi ${profile.display_name || ""},</p><p>${message.replace(/\n/g, "<br>")}</p><p>— ${event?.event_name || "MentorMates"} Team</p>`,
            }),
          }
        );

        return { sent: res.ok, email: profile.email };
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r.value as { sent?: boolean }).sent
    ).length;

    return NextResponse.json({
      success: true,
      message: `Sent to ${sent}/${judges.length} judges`,
      details: results.map((r) =>
        r.status === "fulfilled" ? r.value : { error: "failed" }
      ),
    });
  } catch (error) {
    console.error("Agent judges POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
