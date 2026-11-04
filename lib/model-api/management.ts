import "server-only";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { generateApiKey } from "@/lib/agent/crypto";
import { requireModelAccount } from "./auth";
import { BODY_TIMEOUT_MS } from "./config";
import { cursorFilter, nextCursor } from "./pagination";
import {
  errorBody,
  jsonResponse,
  ModelApiError,
  readBoundedText,
} from "./http";
import {
  KEY_COLUMNS,
  REQUEST_COLUMNS,
  type ModelRequestSummary,
  type RequestPage,
} from "./types";

export async function managementResponse(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    const failure =
      error instanceof ModelApiError
        ? error
        : new ModelApiError(
            503,
            "storage_unavailable",
            "Model API storage is temporarily unavailable.",
          );
    return jsonResponse(errorBody(failure), failure.status);
  }
}

async function readBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ModelApiError(403, "invalid_origin", "Use the developer console on this site's origin.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ModelApiError(415, "unsupported_media_type", "Send Content-Type: application/json.");
  }
  try {
    return JSON.parse(
      await readBoundedText(
        request,
        4096,
        AbortSignal.timeout(BODY_TIMEOUT_MS),
      ),
    );
  } catch (error) {
    if (error instanceof ModelApiError) throw error;
    throw new ModelApiError(
      400,
      "invalid_json",
      "A valid JSON body is required.",
    );
  }
}

const createKeySchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    expires_at: z
      .string()
      .datetime({ offset: true })
      .refine(
        (value) => Date.parse(value) > Date.now(),
        "Expiry must be in the future",
      )
      .nullable()
      .optional(),
  })
  .strict();

export async function createModelKey(request: Request) {
  const user = await requireModelAccount();
  const parsed = createKeySchema.safeParse(await readBody(request));
  if (!parsed.success)
    throw new ModelApiError(
      400,
      "invalid_key",
      "Provide a label (1–100 characters) and an optional future expiry.",
    );
  const { raw, hash, prefix } = generateApiKey("mm_model_");
  const { data, error } = await createSupabaseServiceClient()
    .from("model_api_keys")
    .insert({
      user_id: user.id,
      key_hash: hash,
      key_prefix: prefix,
      label: parsed.data.label,
      expires_at: parsed.data.expires_at ?? null,
    })
    .select(KEY_COLUMNS)
    .single();
  if (error || !data) throw new Error("Key insert failed");
  return jsonResponse({ api_key: raw, key: data }, 201);
}

export async function listModelKeys(request: Request) {
  const user = await requireModelAccount();
  let query = createSupabaseServiceClient()
    .from("model_api_keys")
    .select(KEY_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor) query = query.or(cursorFilter(cursor));
  const { data, error } = await query;
  if (error) throw new Error("Key list failed");
  const rows = data ?? [];
  return jsonResponse({ keys: rows.slice(0, 25), next_cursor: nextCursor(rows, 25) });
}

export async function revokeModelKey(request: Request) {
  const user = await requireModelAccount();
  const parsed = z
    .object({ key_id: z.string().uuid() })
    .strict()
    .safeParse(await readBody(request));
  if (!parsed.success)
    throw new ModelApiError(
      400,
      "invalid_key_id",
      "A valid key_id is required.",
    );
  const { data, error } = await createSupabaseServiceClient()
    .from("model_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.key_id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Key revocation failed");
  if (!data)
    throw new ModelApiError(404, "key_not_found", "API key not found.");
  return jsonResponse({ success: true });
}

export async function listModelRequests(request: Request) {
  const user = await requireModelAccount();
  const params = new URL(request.url).searchParams;
  const db = createSupabaseServiceClient();
  if (params.has("id")) {
    const id = z.string().uuid().safeParse(params.get("id"));
    if (!id.success)
      throw new ModelApiError(
        400,
        "invalid_request_id",
        "A valid request id is required.",
      );
    const { data, error } = await db
      .from("model_api_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", id.data)
      .maybeSingle();
    if (error) throw new Error("Request lookup failed");
    if (!data)
      throw new ModelApiError(404, "request_not_found", "Request not found.");
    return jsonResponse({ request: data });
  }
  let query = db
    .from("model_api_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  const cursor = params.get("cursor");
  if (cursor) query = query.or(cursorFilter(cursor));
  const { data, error } = await query;
  if (error) throw new Error("Request list failed");
  const rows = (data ?? []) as ModelRequestSummary[];
  const requests = rows.slice(0, 25);
  const page: RequestPage = {
    requests,
    next_cursor: nextCursor(rows, 25),
  };
  return jsonResponse(page);
}
