import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getURL } from "@/app/utils/get-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const cleanBaseUrl = getURL(request);

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
