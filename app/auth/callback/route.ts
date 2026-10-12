import { sendWelcomeProfileEmail } from "@/lib/email/send-welcome-profile";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "../../utils/supabase/server";
import { hasPersistedOnboardingState } from "@/features/user/onboarding/metadata";
import { getSafeRedirectPath } from "@/features/user/authentication/redirect/redirect-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // Use environment variable for base URL, fallback to request origin
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  if (!code) {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  const supabase = await createSupabaseClient();

  // Exchange code for session
  const {
    data: { session },
    error: codeError,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (codeError) {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  if (!session) {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  const user = session.user;
  if (!user?.email) {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  // Try to check user profile first
  const { data: existingProfile, error: profileCheckError } = await supabase
    .from("user_profiles")
    .select("uid, onboarding_metadata")
    .eq("uid", user.id)
    .single();

  if (profileCheckError && profileCheckError.code !== "PGRST116") {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  if (!existingProfile) {
    const profileData = {
      uid: user.id,
      display_name: user.user_metadata?.full_name || user.email.split("@")[0],
      email: user.email,
      created_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert(profileData);

    if (profileError) {
      return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
    }

    // Best-effort: send a welcome email asking them to complete their profile.
    // This is done only the first time we create their profile record.
    try {
      const profileUrl = `${cleanBaseUrl}/profile/${user.id}`;
      await sendWelcomeProfileEmail({
        to: user.email,
        displayName: profileData.display_name,
        profileUrl,
      });
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
    }
  }

  // Default redirect for non-mentor users
  const returnUrl = getSafeRedirectPath(
    searchParams.get("returnUrl"),
    cleanBaseUrl
  );

  // If onboarding metadata is missing or empty, redirect to onboarding flow
  const needsOnboarding = !hasPersistedOnboardingState(
    existingProfile?.onboarding_metadata as Record<string, unknown> | null | undefined
  );

  if (needsOnboarding) {
    const onboardingUrl = new URL("/onboarding", cleanBaseUrl);
    if (returnUrl && returnUrl !== "/") {
      onboardingUrl.searchParams.set("returnUrl", returnUrl);
    }
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.redirect(new URL(returnUrl ?? "/", cleanBaseUrl));
}
