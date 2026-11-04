import { z } from "zod";
import type { Json } from "@/lib/database.types";

// Iterative validation avoids overflowing the call stack on deeply nested JSON.
const json = z.custom<Json>((value) => {
  const queue = [{ value, depth: 0 }];
  while (queue.length) {
    const current = queue.pop()!;
    if (current.depth > 32) return false;
    const item = current.value;
    if (item === null || typeof item === "string" || typeof item === "boolean")
      continue;
    if (typeof item === "number" && Number.isFinite(item)) continue;
    if (typeof item !== "object" || item === null) return false;
    for (const child of Object.values(item))
      queue.push({ value: child, depth: current.depth + 1 });
  }
  return true;
}, "Expected JSON with at most 32 levels of nesting");
const description = json.refine(
  (value) =>
    value === null || typeof value === "string" || typeof value === "object",
);
const instructions = description.refine(
  (value) => value !== null && value !== "",
  "Instructions are required",
);
const question = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("noul"),
      instructions,
      criteria: z
        .object({ true: description.optional(), false: description.optional() })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("choice"),
      instructions,
      criteria: z
        .record(z.string().min(1), description)
        .refine(
          (value) => Object.keys(value).length >= 2,
          "Choice needs at least two options",
        ),
    })
    .strict(),
  z
    .object({
      type: z.literal("score"),
      instructions,
      criteria: z.array(description).min(2),
    })
    .strict(),
]);

export const systemOneSchema = z
  .object({
    model: z.string().min(1).max(100).default("jev-latest"),
    state: description,
    questions: z
      .record(z.string().min(1).max(200), question)
      .refine(
        (value) => Object.keys(value).length > 0,
        "At least one question is required",
      ),
  })
  .strict();
export type SystemOneInput = z.infer<typeof systemOneSchema>;

const probability = z.number().min(0).max(1);
const answer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noul"), noul: probability }).passthrough(),
  z
    .object({
      type: z.literal("choice"),
      choice: z.string(),
      probabilities: z.record(probability),
      confidence: probability,
    })
    .passthrough(),
  z
    .object({
      type: z.literal("score"),
      score: z.number().finite(),
      legend: z.record(description),
      probabilities: z.record(probability),
      confidence: probability,
    })
    .passthrough(),
]);
export const systemOneResponseSchema = z
  .object({
    model: z.string().min(1),
    answers: z.record(answer),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();
export type SystemOneOutput = z.infer<typeof systemOneResponseSchema>;
