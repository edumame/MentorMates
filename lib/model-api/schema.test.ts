/** @jest-environment node */
import { systemOneSchema } from "./schema";
import { readBoundedText, redactSecrets } from "./http";

const input = {
  state: "hello",
  questions: { test: { type: "noul", instructions: "Is this a greeting?" } },
};
describe("model request validation", () => {
  it("defaults the model and accepts all three documented primitives with structured criteria", () => {
    const parsed = systemOneSchema.parse({
      ...input,
      questions: {
        ...input.questions,
        category: {
          type: "choice",
          instructions: { task: "Classify" },
          criteria: { yes: { examples: ["hi"] }, no: null },
        },
        rating: {
          type: "score",
          instructions: "Rate",
          criteria: [{ meaning: "low" }, { meaning: "high" }],
        },
      },
    });
    expect(parsed.model).toBe("jev-latest");
    expect(Object.keys(parsed.questions)).toHaveLength(3);
  });
  it.each([
    null,
    {},
    { ...input, state: undefined },
    { ...input, questions: {} },
    { ...input, questions: { test: { type: "unknown", instructions: "x" } } },
    {
      ...input,
      questions: {
        test: { type: "choice", instructions: "x", criteria: { only: null } },
      },
    },
    {
      ...input,
      questions: {
        test: { type: "score", instructions: "x", criteria: ["one"] },
      },
    },
    { ...input, apiKey: "override" },
    { ...input, baseURL: "https://example.com" },
  ])("rejects malformed or unsupported request %#", (body) => {
    expect(systemOneSchema.safeParse(body).success).toBe(false);
  });
  it("rejects excessive nesting without overflowing the stack", () => {
    let state: unknown = "hello";
    for (let i = 0; i < 100; i++) state = { nested: state };
    expect(systemOneSchema.safeParse({ ...input, state }).success).toBe(false);
  });
});

describe("bounded body reader", () => {
  it("enforces the actual UTF-8 byte length even without Content-Length", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: "éé",
    });
    await expect(
      readBoundedText(request, 3, new AbortController().signal),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects a declared oversize body", async () => {
    await expect(
      readBoundedText(
        new Response("x", { headers: { "Content-Length": "500" } }),
        10,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("cancels a stalled body at the deadline", async () => {
    const cancel = jest.fn();
    const response = new Response(new ReadableStream({ cancel }));
    const controller = new AbortController();
    const pending = readBoundedText(response, 10, controller.signal);
    controller.abort();
    await expect(pending).rejects.toHaveProperty("name", "AbortError");
    expect(cancel).toHaveBeenCalled();
  });
  it("redacts exact bearer secrets in nested input and provider errors", () => {
    expect(
      redactSecrets({ nested: ["prefix secret-key suffix"], answer: 1 }, [
        "secret-key",
        "",
      ]),
    ).toEqual({ nested: ["prefix [REDACTED] suffix"], answer: 1 });
  });
});
