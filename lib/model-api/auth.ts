import "server-only";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashApiKey } from "@/lib/agent/crypto";
import { ModelApiError } from "./http";

export async function requireModelAccount() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) {
    throw new ModelApiError(
      401,
      "account_required",
      "Sign in to your account to manage model API access.",
    );
  }
  return user;
}

export async function authenticateModelKey(request: Request) {
  const match = /^Bearer (mm_model_[a-f0-9]{64})$/i.exec(
    request.headers.get("authorization") || "",
  );
  if (!match)
    throw new ModelApiError(
      401,
      "invalid_api_key",
      "Use Authorization: Bearer <model API key>.",
    );
  const secret = match[1];
  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from("model_api_keys")
    .select("id,user_id,revoked_at,expires_at")
    .eq("key_hash", hashApiKey(secret))
    .maybeSingle();
  if (error)
    throw new ModelApiError(
      503,
      "authentication_unavailable",
      "API key verification is temporarily unavailable.",
    );
  if (
    !data ||
    data.revoked_at ||
    (data.expires_at && Date.parse(data.expires_at) <= Date.now())
  ) {
    throw new ModelApiError(
      401,
      "invalid_api_key",
      "The model API key is invalid, expired, or revoked.",
    );
  }
  return { userId: data.user_id, keyId: data.id, secret };
}
