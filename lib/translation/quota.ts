import { z } from "zod";

/**
 * Per-user quota for cache-miss translations (paid OpenAI calls).
 * Enforced atomically by `reserve_translation_request` in
 * supabase/migrations/202610270003_translation_request_quota.sql, which owns
 * the limits (30 requests and 100,000 source characters per user per UTC hour).
 */

export class TranslationQuotaUnavailableError extends Error {
  constructor() {
    super("Translation is temporarily unavailable");
  }
}

export interface TranslationQuotaClient {
  rpc(
    name: "reserve_translation_request",
    args: { p_user_id: string; p_char_count: number },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

const decisionSchema = z
  .array(
    z.object({
      allowed: z.boolean(),
      retry_after_seconds: z.number().int().min(0).max(3600),
    }),
  )
  .length(1);

/**
 * Reserve one cache-miss translation. Fails closed: any RPC error or
 * unexpected response throws TranslationQuotaUnavailableError.
 * The caller supplies only the ID returned by auth.getUser, never request data.
 */
export async function reserveTranslationQuota(
  client: TranslationQuotaClient,
  verifiedUserId: string,
  charCount: number,
) {
  let result;
  try {
    result = await client.rpc("reserve_translation_request", {
      p_user_id: verifiedUserId,
      p_char_count: charCount,
    });
  } catch {
    throw new TranslationQuotaUnavailableError();
  }
  const parsed = decisionSchema.safeParse(result.data);
  if (result.error || !parsed.success) throw new TranslationQuotaUnavailableError();
  const decision = parsed.data[0];
  if (!decision.allowed && decision.retry_after_seconds < 1) {
    throw new TranslationQuotaUnavailableError();
  }
  return decision;
}
