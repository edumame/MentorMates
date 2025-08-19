import { NextResponse } from "next/server";
import { createSupabaseClient } from "../../utils/supabase/server";
import { getURL } from "@/app/utils/get-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const cleanBaseUrl = getURL(request);

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
    .select("uid")
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
  }

  // Default redirect for non-mentor users
  const returnUrl = searchParams.get("returnUrl") || "";
  const cleanReturnUrl = returnUrl.startsWith("/")
    ? returnUrl.slice(1)
    : returnUrl;

  const participantRedirectUrl = `${cleanBaseUrl}/${cleanReturnUrl}`;
  return NextResponse.redirect(participantRedirectUrl);
}
