import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getAppBaseUrl, getAuthErrorRedirect } from "../auth-flow";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return getAuthErrorRedirect(request.url);
  }

  const supabase = await createSupabaseClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    return getAuthErrorRedirect(request.url);
  }

  return NextResponse.redirect(new URL("/reset-password", getAppBaseUrl(request.url)));
}
