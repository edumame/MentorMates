import JSONL from "jsonl-parse-stringify";
import { inngest } from "@/lib/inngest/client";
import { createAgent, openai, TextMessage } from "@inngest/agent-kit";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/inngest/prompts";

/**
 * Fetches the system prompt from the database for a given agent ID.
 * Returns the prompt text if found and active, otherwise returns the default prompt.
 */
async function getSystemPrompt(agentId: string): Promise<{
  promptText: string;
  scoringEnabled: boolean;
}> {
  const supabase = await createSupabaseServiceClient();
  try {
    // Prefer agent-specific fields if present: feedback_prompt, scoring
    const { data: agentRow, error: agentErr } = await supabase
      .from("agents")
      .select("feedback_prompt, scoring")
      .eq("id", agentId)
      .maybeSingle();

    let agentScoring = true;
    if (agentErr) {
      console.error("Failed to fetch agent row for system prompt fallback:", agentErr);
    } else {
      agentScoring = agentRow?.scoring ?? agentScoring;
      if (agentRow && agentRow.feedback_prompt) {
        console.log("Using feedback_prompt from agents table for agent:", agentId);
        return {
          promptText: agentRow.feedback_prompt as string,
          scoringEnabled: agentRow.scoring ?? true,
        };
      }
    }

    // Fallback to system_prompts table (existing behavior)
    const { data: systemPrompt, error: systemPromptError } = await supabase
      .from("system_prompts")
      .select("prompt_text")
      .eq("agent_id", agentId)
      .eq("is_active", true)
      .maybeSingle();

    if (systemPromptError) {
      console.error("Failed to fetch system prompt:", systemPromptError);
      return { promptText: DEFAULT_SYSTEM_PROMPT, scoringEnabled: agentScoring };
    }

    if (!systemPrompt) {
      console.error("No system prompt found for agent:", agentId);
      return { promptText: DEFAULT_SYSTEM_PROMPT, scoringEnabled: agentScoring };
    }

    console.log("Agent system prompt fetched from database.");
    return { promptText: systemPrompt.prompt_text, scoringEnabled: agentScoring };
  } catch (err) {
    console.error("Unexpected error fetching system prompt:", err);
    return { promptText: DEFAULT_SYSTEM_PROMPT, scoringEnabled: true };
  }
}

function extractOverallScore(summary: string): number {
  const match = summary.match(/\b(\d{1,3})\s\/\s100\b/);

  if (!match) {
    throw new Error("Could not extract Overall Score from summary");
  }

  const score = Number(match[1]);

  if (Number.isNaN(score) || score < 0 || score > 100) {
    throw new Error(`Invalid score extracted: ${match[1]}`);
  }

  return score;
}

export const meetingsProcessing = inngest.createFunction(
  { id: "meetings/processing" },
  { event: "meetings/processing" },
  async ({ event, step }) => {
    // agentId should be provided on the event; fall back to "summarizer"
    const agentId = event.data && event.data.agentId || "summarizer";

    const supabase = await createSupabaseServiceClient();
    const response = await step.run("fetch-transcript", async () => {
      return fetch(event.data.transcriptUrl).then((res) => res.text());
    });

    const transcript = await step.run("parse-transcript", async () => {
      return JSONL.parse<StreamTranscriptItem>(response);
    });

    const transcriptWithSpeakers = await step.run("add-speakers", async () => {
      const speakerIds = [
        ...new Set(transcript.map((item) => item.speaker_id)),
      ];

      const { data: userSpeakers } = await supabase
        .from("user_profiles")
        .select("*")
        .in("uid", speakerIds);

      const { data: agentSpeakers } = await supabase
        .from("agents")
        .select("*")
        .in("id", speakerIds);

      const speakers = [...(userSpeakers ?? []), ...(agentSpeakers ?? [])];

      return transcript.map((item) => {
        const speaker = speakers.find(
          (speaker) =>
            speaker.id === item.speaker_id || speaker.uid === item.speaker_id
        );

        if (!speaker) {
          return {
            ...item,
            user: {
              name: "Unknown",
            },
          };
        }

        return {
          ...item,
          user: {
            name: speaker.name,
          },
        };
      });
    });

    const systemPromptRes = await step.run("get-system-prompt", async () => {
      return await getSystemPrompt(agentId);
    });

    const { promptText, scoringEnabled } = systemPromptRes as {
      promptText: string;
      scoringEnabled: boolean;
    };

    let finalSystemPrompt = promptText;
    if (!scoringEnabled) {
      // Prepend a clear prohibition to override any scoring instructions
      finalSystemPrompt =
        "Important: Do NOT include any numeric scores, ratings, or 'Overall Score' lines in your output. Only provide the textual summary.\n\n" +
        promptText;
    }
    const summarizer = createAgent({
      name: agentId,
      system: finalSystemPrompt,
      model: openai({ model: "gpt-5.2", apiKey: process.env.OPENAI_API_KEY }),
    });

    const { output } = await summarizer.run(
      "Summarize the following transcript: " +
        JSON.stringify(transcriptWithSpeakers)
    );

    const summary = output.find(
      (msg): msg is TextMessage => msg.type === "text"
    )?.content;

    if (!summary) {
      throw new Error("No summary generated by agent");
    }

    await step.run("save-summary", async () => {
      const summary = (output[0] as TextMessage).content as string;

      let score: number | null = null;
      try {
        if (scoringEnabled) {
          score = extractOverallScore(summary);
        }
      } catch (error) {
        console.error("Failed to extract overall score:", error);
        // Continue without score - job should still complete
      }

      const { error } = await supabase
        .from("meetings")
        .update({
          summary,
          ...(score !== null && { score }),
          status: "completed",
        })
        .eq("id", event.data.meetingId);

      if (error) throw error;
    });
  }
);
