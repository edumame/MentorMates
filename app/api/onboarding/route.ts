import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { z } from "zod";
import {
  AI_TOOL_VALUES,
  NON_AI_TOOL_VALUES,
  FAMILIARITY_VALUES,
  GOAL_VALUES,
  ROLE_VALUES,
  INDUSTRY_VALUES,
} from "@/features/user/onboarding/questions-data";

const OnboardingSchema = z.object({
  version: z.number().int().min(1),
  completedAt: z.string().datetime(),
  answers: z.object({
    familiarity: z.enum(FAMILIARITY_VALUES),
    mainGoals: z.array(z.enum(GOAL_VALUES)).min(1),
    role: z.enum(ROLE_VALUES),
    industries: z.array(z.enum(INDUSTRY_VALUES)).min(1),
    aiTools: z.array(z.enum(AI_TOOL_VALUES)).default([]),
    nonAiTools: z.array(z.enum(NON_AI_TOOL_VALUES)).default([]),
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

