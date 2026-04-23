import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/stream-chat";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const meetingId = body?.meetingId;

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const supabase = await createSupabaseServiceClient();
    const { data: userData } = await supabase.auth.getUser();

    const userId = userData?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
      const channel = streamChat.channel("messaging", meetingId);
      // Query messages directly without watch() for better performance
      const { messages } = await channel.query({ messages: { limit: 200 } });

      type StreamMessage = { text?: string | null; user?: { id?: string; name?: string } };

      const count = (messages || [])
        .filter((m) => {
          const msg = m as StreamMessage;
          const text = (msg?.text || "").toString().trim();
          const authorId = msg?.user?.id || msg?.user?.name;
          return !!text && authorId === userId;
        })
        .length;

      return NextResponse.json({ hasUserMessages: count > 0, count });
    } catch (e) {
      console.error("failed to fetch channel messages", e);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
  } catch (e) {
    console.error("Invalid request", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
