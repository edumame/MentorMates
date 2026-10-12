/**
 * TinyFish API Client
 *
 * Communicates with the TinyFish AI web automation API via Server-Sent Events (SSE).
 * Sends a URL + natural language goal, receives structured data back.
 */

const DEFAULT_BASE_URL = "https://agent.tinyfish.ai/v1";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface TinyFishConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  browserProfile?: "lite" | "stealth";
}

export interface AutomationRequest {
  url: string;
  goal: string;
  browser_profile?: "lite" | "stealth";
  proxy_config?: {
    enabled: boolean;
    country?: string;
  };
}

export interface SSEEvent {
  type: string;
  status?: string;
  message?: string;
  purpose?: string;
  resultJson?: {
    input?: unknown;
    parsed?: unknown;
  };
  error?: string;
  runId?: string;
  streamingUrl?: string;
  timestamp?: string;
}

export interface AutomationResult {
  success: boolean;
  data: unknown;
  error?: string;
  steps: number;
  runId?: string;
  streamingUrl?: string;
}

export class TinyFishClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private browserProfile: "lite" | "stealth";

  constructor(config: TinyFishConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.browserProfile = config.browserProfile ?? "lite";
  }

  async runAutomation(req: AutomationRequest): Promise<AutomationResult> {
    const body: AutomationRequest = {
      ...req,
      browser_profile: req.browser_profile ?? this.browserProfile,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/automation/run-sse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`TinyFish API error (${response.status}): ${text}`);
      }

      if (!response.body) {
        throw new Error("No response body received from TinyFish API");
      }

      return await this.processSSEStream(response.body);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async processSSEStream(
    body: ReadableStream<Uint8Array>
  ): Promise<AutomationResult> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let steps = 0;
    let runId: string | undefined;
    let streamingUrl: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line === "" || line.startsWith(":")) continue;

        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          let event: SSEEvent;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          steps++;

          if (event.runId) runId = event.runId;
          if (event.streamingUrl) streamingUrl = event.streamingUrl;

          if (event.type === "PROGRESS" || event.purpose) {
            console.log(
              `  [step ${steps}] ${event.purpose ?? event.message ?? "..."}`
            );
          }

          if (event.type === "COMPLETE" || event.status === "COMPLETED") {
            const eventAny = event as unknown as Record<string, unknown>;
            console.log(`  [COMPLETE] keys: ${Object.keys(eventAny).join(", ")}`);
            console.log(`  [COMPLETE] resultJson present: ${!!event.resultJson}`);

            let extractedData: unknown = null;

            // Strategy 1: resultJson.parsed or resultJson.input
            if (event.resultJson) {
              const rj = event.resultJson as Record<string, unknown>;
              console.log(`  [COMPLETE] resultJson keys: ${Object.keys(rj).join(", ")}`);

              if ("parsed" in rj && rj.parsed != null) {
                extractedData = rj.parsed;
              } else if (
                "input" in rj &&
                rj.input != null &&
                Object.keys(rj).length <= 2
              ) {
                if (typeof rj.input === "string") {
                  try {
                    extractedData = JSON.parse(rj.input);
                  } catch {
                    extractedData = rj.input;
                  }
                } else {
                  extractedData = rj.input;
                }
              } else {
                extractedData = rj;
              }
            }

            // Strategy 2: event.result
            if (extractedData == null && "result" in eventAny && eventAny.result != null) {
              console.log(`  [COMPLETE] Trying event.result`);
              extractedData = eventAny.result;
            }

            // Strategy 3: event.data
            if (extractedData == null && "data" in eventAny && eventAny.data != null) {
              console.log(`  [COMPLETE] Trying event.data`);
              extractedData = eventAny.data;
            }

            // Strategy 4: event.output
            if (extractedData == null && "output" in eventAny && eventAny.output != null) {
              console.log(`  [COMPLETE] Trying event.output`);
              extractedData = eventAny.output;
            }

            // Strategy 5: event.message might contain JSON
            if (extractedData == null && event.message) {
              console.log(`  [COMPLETE] Trying event.message (length: ${event.message.length})`);
              const msg = event.message;
              if (msg.includes("{")) {
                try {
                  extractedData = JSON.parse(msg);
                } catch {
                  const start = msg.indexOf("{");
                  const end = msg.lastIndexOf("}");
                  if (start !== -1 && end > start) {
                    try {
                      extractedData = JSON.parse(msg.slice(start, end + 1));
                    } catch { /* ignore */ }
                  }
                }
              }
            }

            console.log(`  [COMPLETE] extractedData type: ${typeof extractedData}, isNull: ${extractedData == null}`);

            return {
              success: true,
              data: extractedData,
              steps,
              runId,
              streamingUrl,
            };
          }

          if (event.type === "ERROR" || event.error) {
            return {
              success: false,
              data: null,
              error: event.error ?? event.message ?? "Unknown error",
              steps,
              runId,
              streamingUrl,
            };
          }
        }
      }
    }

    return {
      success: false,
      data: null,
      error: "SSE stream ended without COMPLETE or ERROR event",
      steps,
      runId,
      streamingUrl,
    };
  }
}
