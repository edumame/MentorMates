import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/stream-chat";
import { authorizeMeetingRequest } from "@/lib/meetings/route-access";

export async function POST(req: NextRequest) {
  try {
    const access = await authorizeMeetingRequest(req);
    if (access.response) return access.response;
    const { messages } = await streamChat.channel("messaging", access.meeting.id)
      .query({ messages: { limit: 200 } });
    const count = (messages || []).filter((message) =>
      typeof message.text === "string" && message.text.trim() &&
      (message.user?.id || message.user?.name) === access.userId
    ).length;
    return NextResponse.json({ hasUserMessages: count > 0, count });
  } catch (error) {
    console.error("Meeting messages lookup failed", error);
    return NextResponse.json({ error: "Unable to fetch messages" }, { status: 500 });
  }
}
