import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { z } from "zod";

// Schema for social links validation
const SocialLinksSchema = z
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
const ProfileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  links: SocialLinksSchema.optional(),
  // New name for the former `school` column (supports school/company/other)
  affiliation: z.string().max(200).optional().nullable(),
  // Backwards compat: accept `school` from older clients and map it to `affiliation`
  school: z.string().max(200).optional().nullable(),
  phone_number: z.string().max(50).optional().nullable(),
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

    const {
      display_name,
      avatar_url,
      bio,
      links,
      affiliation,
      school,
      phone_number,
    } = validationResult.data;

    const updateData: Record<string, unknown> = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (bio !== undefined) updateData.bio = bio;
    if (links !== undefined) updateData.links = links;
    const affiliationValue = affiliation ?? school;
    if (affiliationValue !== undefined) updateData.affiliation = affiliationValue;

    // Handle phone number update separately in user_phone_numbers table
    if (phone_number !== undefined) {
      if (phone_number === null || phone_number === "") {
        // Delete all phone numbers for this user
        const { error: deleteError } = await supabase
          .from("user_phone_numbers")
          .delete()
          .eq("user_id", userId);

        if (deleteError) {
          console.error("Error deleting phone numbers:", deleteError);
          return NextResponse.json(
            { error: "Failed to update phone number" },
            { status: 500 }
          );
        }
      } else {
        // Check if user already has this phone number
        const { data: existingPhone, error: checkError } = await supabase
          .from("user_phone_numbers")
          .select("id")
          .eq("user_id", userId)
          .eq("phone_number", phone_number)
          .single();

        if (checkError && checkError.code !== "PGRST116") {
          // PGRST116 is "not found" which is fine
          console.error("Error checking existing phone number:", checkError);
          return NextResponse.json(
            { error: "Failed to update phone number" },
            { status: 500 }
          );
        }

        if (existingPhone) {
          // Phone number already exists, no need to insert
          // Optionally update verification status if needed
        } else {
          // Get existing phone numbers to determine if this should be primary
          const { data: existingPhones } = await supabase
            .from("user_phone_numbers")
            .select("id, verification_status")
            .eq("user_id", userId);

          // If user has no phone numbers, or all are unverified, make this one primary
          const hasVerifiedPhone =
            existingPhones?.some(
              (p) => p.verification_status === "verified"
            ) ?? false;

          // Insert new phone number
          const { error: insertError } = await supabase
            .from("user_phone_numbers")
            .insert({
              user_id: userId,
              phone_number: phone_number,
              verification_status: hasVerifiedPhone ? "unverified" : "unverified",
            });

          if (insertError) {
            console.error("Error inserting phone number:", insertError);
            return NextResponse.json(
              { error: "Failed to update phone number" },
              { status: 500 }
            );
          }
        }
      }
    }

    if (Object.keys(updateData).length === 0 && phone_number === undefined) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update user_profiles if there are other fields to update
    let updatedProfile = null;
    if (Object.keys(updateData).length > 0) {
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

      updatedProfile = data;
    } else {
      // If only phone number was updated, fetch the profile
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("uid", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return NextResponse.json(
          { error: "Failed to fetch updated profile" },
          { status: 500 }
        );
      }

      updatedProfile = data;
    }

    // Fetch the updated phone number to include in response
    // Note: This is safe because we already verified user.id === userId above
    let primaryPhoneNumber: string | null = null;

    // First try to get a verified phone number
    const { data: verifiedPhones } = await supabase
      .from("user_phone_numbers")
      .select("phone_number")
      .eq("user_id", userId)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1);

    if (verifiedPhones && verifiedPhones.length > 0) {
      primaryPhoneNumber = verifiedPhones[0].phone_number;
    } else {
      // If no verified phone, get the most recent one
      const { data: recentPhones } = await supabase
        .from("user_phone_numbers")
        .select("phone_number")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentPhones && recentPhones.length > 0) {
        primaryPhoneNumber = recentPhones[0].phone_number;
      }
    }

    return NextResponse.json({
      profile: {
        ...updatedProfile,
        phone_number: primaryPhoneNumber,
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
