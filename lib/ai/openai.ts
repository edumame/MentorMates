import OpenAI from "openai";

// NOTE: Server-only utility. Do not import this file in client components.
export const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

export async function createJsonCompletion({
  model,
  messages,
  temperature = 0.2,
  maxTokens = 1500,
}: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const completion = await openaiClient.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const content = completion.choices?.[0]?.message?.content ?? "{}";
  return content;
}