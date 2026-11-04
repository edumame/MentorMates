/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/model-api/auth", () => ({ authenticateModelKey: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock("@/lib/model-api/providers", () => ({ getModelProvider: jest.fn() }));

import { POST } from "./route";
import { authenticateModelKey } from "@/lib/model-api/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getModelProvider } from "@/lib/model-api/providers";
import { ModelApiError } from "@/lib/model-api/http";

const input = {
  model: "jev-latest",
  state: "hello",
  questions: { test: { type: "noul", instructions: "Greeting?" } },
};
const result = {
  model: "jev-1.13.0",
  answers: { test: { type: "noul", noul: 0.9 } },
  usage: { input_tokens: 10, output_tokens: 2 },
};
const rpc = jest.fn();
const update = jest.fn();
const evaluate = jest.fn();
const persist = jest.fn();
function request(body: unknown = input, raw = false) {
  return new Request("https://example.com/api/v1/systemone", {
    method: "POST",
    body: raw ? String(body) : JSON.stringify(body),
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  (authenticateModelKey as jest.Mock).mockResolvedValue({
    userId: "owner",
    keyId: "key",
    secret: "user-secret",
  });
  rpc.mockResolvedValue({
    data: [{ allowed: true, retry_after: 0 }],
    error: null,
  });
  const eq = jest.fn().mockReturnValue({ eq: persist });
  persist.mockResolvedValue({ error: null });
  update.mockReturnValue({ eq });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    rpc,
    from: jest.fn().mockReturnValue({ update }),
  });
  evaluate.mockResolvedValue(result);
  (getModelProvider as jest.Mock).mockReturnValue({ id: "typesafe", evaluate });
});

it("records full input before inference and saves output and usage before returning", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Request-Log-Status")).toBe("complete");
  expect(rpc).toHaveBeenCalledWith(
    "begin_model_api_request",
    expect.objectContaining({
      p_user_id: "owner",
      p_key_id: "key",
      p_request_body: input,
    }),
  );
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
    evaluate.mock.invocationCallOrder[0],
  );
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      state: "succeeded",
      response_body: result,
      input_tokens: 10,
      resolved_model: "jev-1.13.0",
    }),
  );
});
it("does not record or infer for unauthorized callers", async () => {
  (authenticateModelKey as jest.Mock).mockRejectedValue(
    new ModelApiError(401, "invalid_api_key", "Invalid"),
  );
  expect((await POST(request())).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
  expect(evaluate).not.toHaveBeenCalled();
});
it("fails before inference if durable recording fails", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "db_down" } });
  expect((await POST(request())).status).toBe(503);
  expect(evaluate).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
it("catches revocation between authentication and admission", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "28000" } });
  expect((await POST(request())).status).toBe(401);
  expect(evaluate).not.toHaveBeenCalled();
});
it("records account-limit rejection and supplies Retry-After", async () => {
  rpc.mockResolvedValue({
    data: [{ allowed: false, retry_after: 45 }],
    error: null,
  });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("45");
  expect(evaluate).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      http_status: 429,
      error_code: "rate_limit_exceeded",
    }),
  );
});
it.each([
  ["{", true],
  [{ questions: {} }, false],
  [null, false],
])("records invalid input without calling Jev %#", async (body, raw) => {
  expect((await POST(request(body, raw as boolean))).status).toBe(400);
  expect(rpc).toHaveBeenCalled();
  expect(evaluate).not.toHaveBeenCalled();
});
it("rejects oversized bodies and logs the rejection without storing the oversized payload", async () => {
  expect((await POST(request("a".repeat(262145), true))).status).toBe(413);
  expect(rpc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ p_request_body: null }),
  );
  expect(evaluate).not.toHaveBeenCalled();
});
it("records provider error bodies but returns a stable safe error to callers", async () => {
  evaluate.mockRejectedValue(
    new ModelApiError(
      422,
      "provider_error",
      "Provider rejected request",
      422,
      null,
      { reason: "bad criteria" },
    ),
  );
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({
    error: { code: "provider_error" },
  });
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      response_body: { reason: "bad criteria" },
      upstream_status: 422,
      state: "failed",
    }),
  );
});
it("retains the successful result if completion storage fails, marking it incomplete", async () => {
  persist.mockResolvedValue({ error: { message: "down" } });
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(response.headers.get("X-Request-Log-Status")).toBe("incomplete");
  expect(evaluate).toHaveBeenCalledTimes(1);
  consoleError.mockRestore();
});
it("redacts model keys from stored request and response bodies", async () => {
  evaluate.mockResolvedValue({ ...result, echo: "user-secret" });
  const response = await POST(request({ ...input, state: "user-secret" }));
  expect(rpc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      p_request_body: { ...input, state: "[REDACTED]" },
    }),
  );
  expect((await response.json()).echo).toBe("[REDACTED]");
});
