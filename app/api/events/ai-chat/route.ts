import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildMessages,
  parseAIResponse,
  type ChatMessage,
  type EventLike,
} from "@/lib/ai-chat";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured on the server." },
      { status: 500 }
    );
  }

  let body: {
    message?: string;
    event?: EventLike;
    history?: ChatMessage[];
    context?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message, event, history = [], context = "submission" } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Missing required field: message" },
      { status: 400 }
    );
  }

  if (!event || typeof event !== "object") {
    return NextResponse.json(
      { error: "Missing required field: event" },
      { status: 400 }
    );
  }

  try {
    const messages = buildMessages(event, history, message, context);

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const result = parseAIResponse(raw);

    return NextResponse.json({
      reply: result.reply,
      patch: result.patch,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI request failed: ${errMsg}` },
      { status: 502 }
    );
  }
}
