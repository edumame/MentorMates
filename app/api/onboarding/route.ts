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
  PLATFORM_ROLE_VALUES,
} from "@/features/user/onboarding/questions-data";
import { ONBOARDING_SKIP_STATUS } from "@/features/user/onboarding/metadata";

// Version 1 schema (legacy with industries and tools)
const OnboardingSchemaV1 = z.object({
  version: z.literal(1),
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

// Version 2 schema (streamlined flow with platform role, no industries/tools)
const OnboardingSchemaV2 = z.object({
  version: z.literal(2),
  completedAt: z.string().datetime(),
  answers: z.object({
    familiarity: z.enum(FAMILIARITY_VALUES),
    mainGoals: z.array(z.enum(GOAL_VALUES)).min(1),
    role: z.enum(ROLE_VALUES),
    platformRole: z.enum(PLATFORM_ROLE_VALUES),
  }),
});

// Version 3 schema (full flow with all original fields plus platform role)
const OnboardingSchemaV3 = z.object({
  version: z.literal(3),
  completedAt: z.string().datetime(),
  answers: z.object({
    familiarity: z.enum(FAMILIARITY_VALUES),
    mainGoals: z.array(z.enum(GOAL_VALUES)).min(1),
    role: z.enum(ROLE_VALUES),
    industries: z.array(z.enum(INDUSTRY_VALUES)).min(1),
    aiTools: z.array(z.enum(AI_TOOL_VALUES)).default([]),
    nonAiTools: z.array(z.enum(NON_AI_TOOL_VALUES)).default([]),
    platformRole: z.enum(PLATFORM_ROLE_VALUES),
  }),
});

// Version 4 schema (explicit skip so users are not re-routed into onboarding)
const OnboardingSchemaV4 = z.object({
  version: z.literal(4),
  status: z.literal(ONBOARDING_SKIP_STATUS),
  skippedAt: z.string().datetime(),
});

// Combined schema that accepts any version
const OnboardingSchema = z.union([
  OnboardingSchemaV1,
  OnboardingSchemaV2,
  OnboardingSchemaV3,
  OnboardingSchemaV4,
]);

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
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
