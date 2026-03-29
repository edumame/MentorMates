import { type EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getAuthErrorRedirect, redirectAfterAuth } from "../auth-flow";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const redirectTo = searchParams.get("redirect_to") ?? searchParams.get("next");

  if (!tokenHash || !type) {
    return getAuthErrorRedirect(request.url);
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !user) {
    return getAuthErrorRedirect(request.url);
  }

  return redirectAfterAuth({
    requestUrl: request.url,
    redirectTo,
    supabase,
    user,
  });
}
