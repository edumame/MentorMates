/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });

import { jevProvider, getModelProvider } from "./providers";
import type { SystemOneInput } from "./schema";

const input: SystemOneInput = {
  model: "jev-latest",
  state: "hi",
  questions: { test: { type: "noul", instructions: "Greeting?" } },
};
const output = {
  model: "jev-1.13.0",
  answers: { test: { type: "noul", noul: 0.9 } },
  usage: { input_tokens: 10, output_tokens: 2 },
};
const originalFetch = global.fetch;
const originalKey = process.env.TYPESAFE_API_KEY;
beforeEach(() => {
  global.fetch = jest.fn();
  process.env.TYPESAFE_API_KEY = "upstream-test-secret";
});
afterAll(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalKey;
});

describe("Jev provider", () => {
  it("sends exactly one call to the fixed origin using the server credential", async () => {
    (fetch as jest.Mock).mockResolvedValue(Response.json(output));
    expect(await jevProvider.evaluate(input, 1000)).toEqual(output);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.typesafe.ai/v1/systemone",
      expect.objectContaining({
        redirect: "error",
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          Authorization: "Bearer upstream-test-secret",
          "Content-Type": "application/json",
        },
      }),
    );
  });
  it("does not call the provider without configuration", async () => {
    delete process.env.TYPESAFE_API_KEY;
    await expect(jevProvider.evaluate(input, 1000)).rejects.toMatchObject({
      status: 503,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [401, 502],
    [422, 422],
    [429, 429],
    [529, 503],
    [500, 502],
  ])("maps upstream %s to %s without retrying", async (upstream, status) => {
    (fetch as jest.Mock).mockResolvedValue(
      Response.json(
        { detail: "upstream-test-secret" },
        { status: upstream, headers: { "Retry-After": "10" } },
      ),
    );
    await expect(jevProvider.evaluate(input, 1000)).rejects.toMatchObject({
      status,
      upstreamStatus: upstream,
      responseBody: { detail: "[REDACTED]" },
      retryAfter: "10",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    {},
    { ...output, answers: {} },
    { ...output, usage: { input_tokens: -1, output_tokens: 1 } },
  ])("rejects malformed successful responses %#", async (body) => {
    (fetch as jest.Mock).mockResolvedValue(Response.json(body));
    await expect(jevProvider.evaluate(input, 1000)).rejects.toMatchObject({
      status: 502,
      code: "invalid_provider_response",
    });
  });
  it("times out both the connection and body without retrying", async () => {
    (fetch as jest.Mock).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(options.signal.reason),
          );
        }),
    );
    await expect(jevProvider.evaluate(input, 5)).rejects.toMatchObject({
      status: 504,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not resolve arbitrary model IDs to a provider", () => {
    expect(() => getModelProvider("https://example.com")).toThrow(
      "not supported",
    );
    expect(getModelProvider("jev-latest")).toBe(jevProvider);
  });
});
