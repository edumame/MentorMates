import "server-only";
import { randomUUID } from "crypto";
import type { Json } from "@/lib/database.types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { authenticateModelKey } from "./auth";
import { BODY_TIMEOUT_MS, getGatewayConfig, MAX_REQUEST_BYTES } from "./config";
import {
  errorBody,
  jsonResponse,
  ModelApiError,
  readBoundedText,
  redactSecrets,
} from "./http";
import { getModelProvider } from "./providers";
import { systemOneSchema } from "./schema";
import type { ModelRequestRecord } from "./types";

export async function handleSystemOne(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const started = Date.now();
  const headers: Record<string, string> = { "X-Request-Id": requestId };
  let recorded = false;
  let userId: string | undefined;
  let status = 500;
  let body: Json = null;
  let storedResponse: Json = null;
  let secrets: string[] = [];
  const outcome: Partial<ModelRequestRecord> = {};
  try {
    const auth = await authenticateModelKey(request);
    userId = auth.userId;
    secrets = [auth.secret, process.env.TYPESAFE_API_KEY ?? ""];
    const config = getGatewayConfig();
    let requestBody: Json = null;
    let validationError: ModelApiError | undefined;
    try {
      const text = await readBoundedText(
        request,
        MAX_REQUEST_BYTES,
        AbortSignal.timeout(BODY_TIMEOUT_MS),
      );
      try {
        requestBody = JSON.parse(text) as Json;
      } catch {
        requestBody = text;
        validationError = new ModelApiError(
          400,
          "invalid_json",
          "A valid JSON body is required.",
        );
      }
    } catch (error) {
      validationError =
        error instanceof ModelApiError
          ? error
          : new ModelApiError(
              400,
              "invalid_body",
              "The request body could not be read.",
            );
    }
    const requestedModel =
      requestBody &&
      typeof requestBody === "object" &&
      !Array.isArray(requestBody) &&
      typeof requestBody.model === "string"
        ? requestBody.model.slice(0, 100)
        : "jev-latest";
    const db = createSupabaseServiceClient();
    const { data: admission, error } = await db.rpc("begin_model_api_request", {
      p_user_id: auth.userId,
      p_key_id: auth.keyId,
      p_request_id: requestId,
      p_request_body: redactSecrets(requestBody, secrets),
      p_model: requestedModel,
      p_minute_limit: config.minuteLimit,
      p_day_limit: config.dayLimit,
    });
    if (error?.code === "28000")
      throw new ModelApiError(
        401,
        "invalid_api_key",
        "The model API key is expired or revoked.",
      );
    if (error || !admission?.[0])
      throw new ModelApiError(
        503,
        "storage_unavailable",
        "The request could not be recorded. No model call was made.",
      );
    recorded = true;
    if (!admission[0].allowed) {
      throw new ModelApiError(
        429,
        "rate_limit_exceeded",
        "Your account's model request limit has been reached.",
        null,
        String(admission[0].retry_after),
      );
    }
    if (validationError) throw validationError;
    const parsed = systemOneSchema.safeParse(requestBody);
    if (!parsed.success)
      throw new ModelApiError(
        400,
        "invalid_request",
        "Provide state, a supported model, and a nonempty map of valid noul, choice, or score questions.",
      );
    const provider = getModelProvider(parsed.data.model);
    outcome.provider = provider.id;
    const result = await provider.evaluate(parsed.data, config.timeoutMs);
    body = redactSecrets(result, secrets) as Json;
    storedResponse = body;
    status = 200;
    outcome.resolved_model = result.model;
    outcome.input_tokens = result.usage.input_tokens;
    outcome.output_tokens = result.usage.output_tokens;
    outcome.upstream_status = 200;
  } catch (error) {
    const failure =
      error instanceof ModelApiError
        ? error
        : new ModelApiError(
            503,
            "gateway_unavailable",
            "The model gateway is temporarily unavailable.",
          );
    status = failure.status;
    body = errorBody(failure, requestId);
    storedResponse = redactSecrets(failure.responseBody ?? body, secrets);
    outcome.error_code = failure.code;
    outcome.upstream_status = failure.upstreamStatus;
    if (failure.retryAfter) headers["Retry-After"] = failure.retryAfter;
  }
  if (recorded) {
    try {
      const { error } = await createSupabaseServiceClient()
        .from("model_api_requests")
        .update({
          ...outcome,
          state: status === 200 ? "succeeded" : "failed",
          http_status: status,
          response_body: storedResponse,
          duration_ms: Date.now() - started,
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("user_id", userId!);
      if (error) throw error;
      headers["X-Request-Log-Status"] = "complete";
    } catch {
      // Keep the durable pending row. Do not turn a successful inference into a
      // retryable failure, which could cause the client to pay for it twice.
      headers["X-Request-Log-Status"] = "incomplete";
      console.error(
        JSON.stringify({ event: "model_request_completion_failed", requestId }),
      );
    }
  }
  return jsonResponse(body, status, headers);
}
