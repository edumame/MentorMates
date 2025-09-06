import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { z } from "zod";

const OnboardingSchema = z.object({
  version: z.number().int().min(1),
  completedAt: z.string().datetime(),
  answers: z.object({
    familiarity: z.enum(["beginner", "intermediate", "advanced"]),
    mainGoals: z
      .array(
        z.enum([
          "build_project",
          "start_startup",
          "learn_skills",
          "prepare_jobs",
          "join_community",
          "exploring",
        ])
      )
      .min(1),
    role: z.enum([
      "developer",
      "design",
      "product",
      "research",
      "marketing",
      "founder",
      "it_security",
      "other",
    ]),
    industries: z
      .array(
        z.enum([
          "education",
          "health",
          "gaming",
          "manufacturing",
          "transport",
          "climate",
          "accessibility",
          "finance_business",
          "other",
        ])
      )
      .min(1),
    tools: z.array(
      z.enum([
        "gamma",
        "chatgpt",
        "canva_ai",
        "notion",
        "replit",
        "cursor",
        "data_analysis",
        "ar_vr",
        "hardware_iot",
      ])
    ),
  }),
});

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();

    const parseResult = OnboardingSchema.safeParse(payload);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ onboarding_metadata: parseResult.data })
      .eq("uid", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save onboarding" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

