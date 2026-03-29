import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { createSupabaseClient } from "@/app/utils/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseClient>>;

type UserProfileRow = {
  uid: string;
  onboarding_metadata: Record<string, unknown> | null;
};

export function getAppBaseUrl(requestUrl: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(requestUrl).origin;
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function getAuthErrorRedirect(requestUrl: string) {
  return NextResponse.redirect(new URL("/auth/auth-code-error", getAppBaseUrl(requestUrl)));
}

function getSafeRedirectPath(redirectTo: string | null, requestUrl: string) {
  if (!redirectTo) {
    return "/";
  }

  try {
    const baseUrl = getAppBaseUrl(requestUrl);
    const baseOrigin = new URL(baseUrl).origin;
    const redirectUrl = new URL(redirectTo, baseUrl);

    if (redirectUrl.origin !== baseOrigin) {
      return "/";
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}` || "/";
  } catch {
    return "/";
  }
}

function needsOnboarding(profile: UserProfileRow | null) {
  if (!profile?.onboarding_metadata) {
    return true;
  }

  if (typeof profile.onboarding_metadata !== "object") {
    return false;
  }

  return Object.keys(profile.onboarding_metadata).length === 0;
}

export async function redirectAfterAuth(params: {
  requestUrl: string;
  redirectTo: string | null;
  supabase: SupabaseServerClient;
  user: Pick<User, "id" | "email" | "user_metadata">;
}) {
  const { requestUrl, redirectTo, supabase, user } = params;

  if (!user.email) {
    return getAuthErrorRedirect(requestUrl);
  }

  const { data: profileData, error: profileCheckError } = await supabase
    .from("user_profiles")
    .select("uid, onboarding_metadata")
    .eq("uid", user.id)
    .single();

  const existingProfile = (profileData ?? null) as UserProfileRow | null;

  if (profileCheckError && profileCheckError.code !== "PGRST116") {
    return getAuthErrorRedirect(requestUrl);
  }

  if (!existingProfile) {
    const { error: profileError } = await supabase.from("user_profiles").insert({
      uid: user.id,
      display_name: user.user_metadata?.full_name || user.email.split("@")[0],
      email: user.email,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      return getAuthErrorRedirect(requestUrl);
    }
  }

  const nextPath = getSafeRedirectPath(redirectTo, requestUrl);
  const baseUrl = getAppBaseUrl(requestUrl);

  if (needsOnboarding(existingProfile ?? null)) {
    const onboardingUrl = new URL("/onboarding", baseUrl);

    if (nextPath !== "/") {
      onboardingUrl.searchParams.set("returnUrl", nextPath);
    }

    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.redirect(new URL(nextPath, baseUrl));
}
