import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { z } from "zod";

// Schema for social links validation
export const SocialLinksSchema = z
  .object({
    linkedin: z.string().url().optional().nullable(),
    github: z.string().url().optional().nullable(),
    twitter: z.string().url().optional().nullable(),
    facebook: z.string().url().optional().nullable(),
    instagram: z.string().url().optional().nullable(),
    youtube: z.string().url().optional().nullable(),
    portfolio: z.string().url().optional().nullable(),
  })
  .partial();

// Schema for profile update request
export const ProfileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  links: SocialLinksSchema.optional(),
});

export type SocialLinks = z.infer<typeof SocialLinksSchema>;
export type ProfileUpdateRequest = z.infer<typeof ProfileUpdateSchema>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow users to update their own profile
    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validate the request body
    const validationResult = ProfileUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { display_name, avatar_url, bio, links } = validationResult.data;

    const updateData: Record<string, unknown> = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (bio !== undefined) updateData.bio = bio;
    if (links !== undefined) updateData.links = links;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("uid", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating user profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
