import { isIP } from "node:net";
import { z } from "zod";

export const MAX_REQUEST_BYTES = 8192;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const SCRAPER_TIMEOUT_MS = 240_000;

export class ScraperRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

/** Read the stream itself: Content-Length may be absent or incorrect. */
export async function readBoundedJson(
  input: Pick<Request, "body">,
  maxBytes: number,
): Promise<unknown> {
  if (!input.body) throw new ScraperRequestError("Missing JSON body", 400);
  const reader = input.body.getReader();
  const decoder = new TextDecoder();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ScraperRequestError("JSON read timed out", 408)), 15_000); });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new ScraperRequestError("JSON body is too large", 413);
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
      return JSON.parse(text);
    } catch {
      throw new ScraperRequestError("Invalid JSON body", 400);
    }
  } finally {
    clearTimeout(timer!);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

const payloadSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  browserProfile: z.enum(["lite", "stealth"]).default("lite"),
}).strict();

function parseHttpsUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch {
    throw new ScraperRequestError("Invalid URL", 400);
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      host.endsWith(".") || host === "localhost" || host.endsWith(".localhost") ||
      host.startsWith("[") || isIP(host)) {
    throw new ScraperRequestError("Use an HTTPS URL with a public hostname and no credentials or custom port", 400);
  }
  return url;
}

/** Extra entries are exact hostnames; only Devpost receives a subdomain wildcard. */
export function parseScraperRequest(input: unknown, allowedHosts = "") {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) throw new ScraperRequestError("Invalid scraper request", 400);
  const url = parseHttpsUrl(parsed.data.url);
  const extraHosts = allowedHosts.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (!(url.hostname === "devpost.com" || url.hostname.endsWith(".devpost.com") || extraHosts.includes(url.hostname))) {
    throw new ScraperRequestError("This event hostname is not enabled for import", 400);
  }
  url.hash = "";
  return { url: url.href, browserProfile: parsed.data.browserProfile };
}

export function scraperProxyConfig(baseUrl: string | undefined, token: string | undefined) {
  if (!baseUrl || !token?.trim()) throw new ScraperRequestError("Scraping service is not configured", 503);
  let url: URL;
  try { url = parseHttpsUrl(baseUrl); } catch {
    throw new ScraperRequestError("Scraping service is not configured", 503);
  }
  if (url.search || url.hash) throw new ScraperRequestError("Scraping service is not configured", 503);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/scrape`;
  return { endpoint: url.href, token: token.trim() };
}

export interface QuotaClient {
  rpc(name: "reserve_scraper_request", args: { p_user_id: string }): PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
}

/** The caller supplies only the ID returned by auth.getUser, never request data. */
export async function reserveScraperQuota(client: QuotaClient, verifiedUserId: string) {
  let result;
  try { result = await client.rpc("reserve_scraper_request", { p_user_id: verifiedUserId }); } catch {
    throw new ScraperRequestError("Scraping is temporarily unavailable", 503);
  }
  const schema = z.array(z.object({ allowed: z.boolean(), retry_after_seconds: z.number().int().min(0).max(3600) })).length(1);
  const parsed = schema.safeParse(result.data);
  if (result.error || !parsed.success) throw new ScraperRequestError("Scraping is temporarily unavailable", 503);
  const decision = parsed.data[0];
  if (!decision.allowed && decision.retry_after_seconds < 1) throw new ScraperRequestError("Scraping is temporarily unavailable", 503);
  return decision;
}
