import { createSupabaseClient } from "../../utils/supabase/server";
import { getAuthErrorRedirect, redirectAfterAuth } from "../auth-flow";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return getAuthErrorRedirect(request.url);
  }

  const supabase = await createSupabaseClient();

  const {
    data: { session },
    error: codeError,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (codeError || !session?.user) {
    return getAuthErrorRedirect(request.url);
  }

  return redirectAfterAuth({
    requestUrl: request.url,
    redirectTo: searchParams.get("returnUrl"),
    supabase,
    user: session.user,
  });
}
