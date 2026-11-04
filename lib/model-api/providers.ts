import "server-only";
import type { Json } from "@/lib/database.types";
import { MAX_RESPONSE_BYTES } from "./config";
import { ModelApiError, readBoundedText, redactSecrets } from "./http";
import {
  systemOneResponseSchema,
  type SystemOneInput,
  type SystemOneOutput,
} from "./schema";

export interface ModelProvider {
  id: string;
  models: readonly string[];
  evaluate(input: SystemOneInput, timeoutMs: number): Promise<SystemOneOutput>;
}

export const jevProvider: ModelProvider = {
  id: "typesafe",
  models: ["jev-latest", "jev-1.13.0", "jev-preview"],
  async evaluate(input, timeoutMs) {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey)
      throw new ModelApiError(
        503,
        "provider_not_configured",
        "The model provider is not configured.",
      );
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      // Fixed origin, server credential, and no redirects: callers cannot choose a destination.
      const response = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const text = await readBoundedText(response, MAX_RESPONSE_BYTES, signal);
      let body: Json;
      try {
        body = JSON.parse(text) as Json;
      } catch {
        body = text;
      }
      body = redactSecrets(body, [apiKey]);
      if (!response.ok) {
        const status =
          response.status === 429
            ? 429
            : response.status === 422 || response.status === 400
              ? 422
              : response.status === 529
                ? 503
                : 502;
        const retry = response.headers.get("retry-after");
        throw new ModelApiError(
          status,
          "provider_error",
          "The model provider could not complete this request.",
          response.status,
          retry && /^\d{1,6}$/.test(retry) ? retry : null,
          body,
        );
      }
      const parsed = systemOneResponseSchema.safeParse(body);
      if (
        !parsed.success ||
        Object.keys(parsed.data.answers).length !==
          Object.keys(input.questions).length ||
        Object.entries(input.questions).some(
          ([id, q]) => parsed.data.answers[id]?.type !== q.type,
        )
      ) {
        throw new ModelApiError(
          502,
          "invalid_provider_response",
          "The model provider returned an invalid response.",
          response.status,
          null,
          body,
        );
      }
      return parsed.data;
    } catch (error) {
      if (signal.aborted)
        throw new ModelApiError(
          504,
          "provider_timeout",
          "The model provider timed out.",
        );
      if (error instanceof ModelApiError && error.code !== "body_too_large")
        throw error;
      throw new ModelApiError(
        502,
        "provider_unavailable",
        "The model provider is unavailable.",
      );
    }
  },
};

const providers: readonly ModelProvider[] = [jevProvider];
export function getModelProvider(model: string) {
  const provider = providers.find((candidate) =>
    candidate.models.includes(model),
  );
  if (!provider)
    throw new ModelApiError(
      400,
      "unsupported_model",
      "This model is not supported.",
    );
  return provider;
}
export function listModels() {
  return providers.flatMap((provider) =>
    provider.models.map((id) => ({
      id,
      provider: provider.id,
      capability: "systemone",
    })),
  );
}
