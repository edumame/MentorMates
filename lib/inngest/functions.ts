import JSONL from "jsonl-parse-stringify";
import { inngest } from "@/lib/inngest/client";
import { createAgent, createTool, openai, TextMessage, ToolResultMessage } from "@inngest/agent-kit";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { buildSystemPrompt } from "@/lib/inngest/prompts";
import { ScoringCriterion } from "@/lib/types";
import { z } from "zod";

/**
 * Simplified scoring config structure as stored in events.scoring_config
 * This matches the database column structure from the migration.
 */
interface SimpleScoringConfig {
  criteria: ScoringCriterion[];
  defaultMin?: number;
  defaultMax?: number;
  defaultWeight?: number;
}

/**
 * Default scoring criteria for agent evaluations.
 * Used when event has no scoring_config defined.
 */
const DEFAULT_SCORING_CRITERIA: ScoringCriterion[] = [
  { id: "problem_clarity", name: "Problem Clarity", description: "How clearly the problem is defined and articulated" },
  { id: "solution_clarity", name: "Solution Clarity", description: "How clearly the solution is explained and differentiated" },
  { id: "user_value", name: "User Value", description: "The strength of the value proposition to target users" },
  { id: "feasibility", name: "Feasibility", description: "Technical and business feasibility of the idea" },
  { id: "storytelling", name: "Storytelling", description: "Quality of presentation, narrative, and delivery" },
];

/**
 * Schema for flexible scoring - accepts any criteria as key-value pairs.
 * Scores are stored as { [criteriaId]: score } where score is 0-100.
 */
const scoringSchema = z.record(z.string(), z.number().min(0).max(100))
  .describe("Object with criteria IDs as keys and scores (0-100) as values");

type CategoryScores = z.infer<typeof scoringSchema>;

interface ScoringResult {
  scores: CategoryScores;
  overall_score: number;
}

/**
 * Creates a scoring tool dynamically based on the criteria.
 * This allows different events to have different scoring criteria.
 */
function createScoringTool(criteria: ScoringCriterion[]) {
  return createTool({
    name: "submit_scores",
    description: `Submit the structured evaluation scores for each category. You MUST call this tool after completing your analysis.

Submit scores as an object with these criteria IDs as keys (score 0-100 for each):
${criteria.map(c => `- ${c.id}: ${c.description || c.name}`).join('\n')}`,
    parameters: scoringSchema,
    handler: async (input: CategoryScores): Promise<ScoringResult> => {
      const scoreValues = Object.values(input).filter((v): v is number => typeof v === "number");
      const overallScore = scoreValues.length > 0
        ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
        : 0;
      return { scores: input, overall_score: overallScore };
    },
  });
}

/**
 * Fetches the system prompt from the database for a given agent ID.
 * Returns the prompt text if found and active, otherwise builds a default prompt with criteria.
 */
async function getSystemPrompt(agentId: string, criteria: ScoringCriterion[]): Promise<string> {
  const supabase = await createSupabaseServiceClient();
  const { data: systemPrompt, error: systemPromptError } = await supabase
    .from("system_prompts")
    .select("prompt_text")
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .maybeSingle();

  if (systemPromptError) {
    console.error("Failed to fetch system prompt:", systemPromptError);
    return buildSystemPrompt(criteria);
  }

  if (!systemPrompt) {
    console.error("No system prompt found for agent:", agentId);
    return buildSystemPrompt(criteria);
  }

  console.log("Agent system prompt fetched from database.");
  return systemPrompt.prompt_text;
}


export const meetingsProcessing = inngest.createFunction(
  { id: "meetings/processing" },
  { event: "meetings/processing" },
  async ({ event, step }) => {
    // this should be dynamic in the future
    const agentId = "summarizer";

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

    // Fetch scoring criteria from event's scoring_config, or use defaults
    const scoringCriteria = await step.run("get-scoring-criteria", async () => {
      // First get the meeting to find its event_id
      const { data: meeting } = await supabase
        .from("meetings")
        .select("event_id")
        .eq("id", event.data.meetingId)
        .maybeSingle();

      if (meeting?.event_id) {
        // Fetch event's scoring config
        const { data: eventData } = await supabase
          .from("events")
          .select("scoring_config")
          .eq("event_id", meeting.event_id)
          .maybeSingle();

        const config = eventData?.scoring_config as SimpleScoringConfig | null;
        if (config?.criteria && config.criteria.length > 0) {
          return config.criteria;
        }
      }

      // Fall back to default criteria
      return DEFAULT_SCORING_CRITERIA;
    });

    const systemPrompt = await step.run("get-system-prompt", async () => {
      return await getSystemPrompt(agentId, scoringCriteria);
    });

    // Create scoring tool with the appropriate criteria
    const scoringTool = createScoringTool(scoringCriteria);

    const summarizer = createAgent({
      name: agentId,
      system: systemPrompt,
      model: openai({ model: "gpt-5", apiKey: process.env.OPENAI_API_KEY }),
      tools: [scoringTool],
      tool_choice: "any", // Force the agent to call the scoring tool
    });

    const { output, toolCalls } = await summarizer.run(
      "Summarize the following transcript: " +
        JSON.stringify(transcriptWithSpeakers)
    );

    const summary = output.find(
      (msg): msg is TextMessage => msg.type === "text"
    )?.content;

    if (!summary) {
      throw new Error("No summary generated by agent");
    }

    // Extract structured scores from tool call results
    const scoreResult = toolCalls.find(
      (tc: ToolResultMessage) => tc.tool.name === "submit_scores"
    );
    const categoryScores = scoreResult?.content as ScoringResult | undefined;

    await step.run("save-summary", async () => {
      const summaryText = (output[0] as TextMessage).content as string;

      const { error } = await supabase
        .from("meetings")
        .update({
          summary: summaryText,
          score: categoryScores?.overall_score ?? null,
          category_scores: categoryScores?.scores ?? null,
          status: "completed",
        })
        .eq("id", event.data.meetingId);

      if (error) throw error;
    });
  }
);
