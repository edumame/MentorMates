import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  if (!code) {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  const supabase = await createSupabaseClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  if (!session) {
    return NextResponse.redirect(`${cleanBaseUrl}/auth/auth-code-error`);
  }

  return NextResponse.redirect(`${cleanBaseUrl}/reset-password`);
}
