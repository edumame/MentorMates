import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { streamVideo } from "@/lib/stream-video";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ meetingId: string }> }
) {
    const supabase = await createSupabaseClient();
    const { meetingId } = await params;

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get meeting and verify ownership
    const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("*, agents(*)")
        .eq("id", meetingId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

    if (meetingError || !meeting) {
        return NextResponse.json({ error: "Meeting not found or not active" }, { status: 404 });
    }

    if (!meeting.agents) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Connect OpenAI agent to the call
    const call = streamVideo.video.call("default", meetingId);
    const realtimeClient = await streamVideo.video.connectOpenAi({
        call,
        openAiApiKey: process.env.OPENAI_API_KEY!,
        agentUserId: meeting.agent_id,
    });

    // Build instructions with project context if available
    let instructions = meeting.agents.instructions || "";

    if (meeting.project_id) {
        const { data: project } = await supabase
            .from("projects")
            .select("project_name, project_description")
            .eq("id", meeting.project_id)
            .single();

        if (project) {
            const title = project.project_name || "";
            const desc = project.project_description || "";
            instructions += `\n\nHere is the project context from the student:\nTitle: ${title}\nDescription: ${desc}`;
        }
    }

    realtimeClient.updateSession({
        instructions,
        input_audio_transcription: {
            model: "whisper-1",
        },
        turn_detection: { type: "server_vad" },
    });

    return NextResponse.json({ success: true });
}
