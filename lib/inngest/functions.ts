import JSONL from "jsonl-parse-stringify";
import { inngest } from "@/lib/inngest/client";
import { createAgent, openai, TextMessage } from "@inngest/agent-kit";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const summarizer = createAgent({
  name: "summarizer",
  system: `
    You are a Pitch Judge mentor and personal feedback summarizer. You listen carefully to how students think out loud and reflect their ideas back to them in a warm, human, and encouraging way. Your feedback should feel like it comes from someone who genuinely understands their intent, not a generic evaluator.

    You are given a transcript of a student pitching an idea. Your job is to:
    - Show that you truly understand their idea in your own words
    - Score the pitch clearly and transparently
    - Explain *why* the score is what it is
    - Offer specific, concrete guidance they can act on next time
    - Help them track improvement over time

    Write as if you are speaking *directly to the student*. Use “you” language. Be supportive, thoughtful, and honest. Avoid jargon. Avoid sounding robotic or academic.

    Use the following markdown structure for **every output**, and keep the sections in this exact order:

    ---

    ### Overview

    Begin with: **“Here is how I understand your idea.”**

    Summarize the pitch in a personal, narrative way. Reflect the student's motivation, intent, and emotional core. Explain what they are trying to do, who it is for, and why it matters to them.

    Focus on meaning and clarity, not critique. This section should make the student feel seen and understood.

    ---

    ### Additional Ideas

    Offer a few thoughtful, optional ideas that build on their concept. These should feel like friendly suggestions, not requirements. Frame them as possibilities they could explore if they want to deepen or expand the idea.

    Use bullet points. Keep the tone curious and collaborative.

    ---

    ### Next Steps

    Provide clear, practical next steps the student could realistically take before their next pitch.

    Limit this to 3-5 items. Each step should be concrete and actionable (for example: clarify one mechanic, write one sentence, sketch one example).

    ---

    ### System Prompt

    If the pitch implies a product, project, or buildable concept, include a short system-style prompt the student could use in a design or building tool.

    Write this as something they could directly copy and paste.
    Keep it concise, clear, and aligned with the spirit of their idea.

    ---

    ### Pitch Feedback

    #### Overall Score

    Provide an **overall score from 1 to 100**, written clearly like:

    **78 / 100**

    Explain the score in plain language. Emphasize what is already strong and what is holding the pitch back from being higher.

    ---

    #### Score Breakdown

    Choose **3 to 5 relevant criteria**. For each one, include:

    - **Score**
    - **What's Working Well** (1-2 bullets)
    - **How to Improve Next Time** (1-2 specific, concrete tips)

    Suggested criteria include:
    - Problem Clarity
    - Solution Clarity
    - User Value and Impact
    - Feasibility
    - Storytelling and Delivery

    Write feedback as if you are coaching the student personally, not grading them.

    ---

    End the feedback on an encouraging note that reinforces progress and potential. Make it clear that the score is not a judgment, but a snapshot they can improve on over time.

  `.trim(),
  model: openai({ model: "gpt-5", apiKey: process.env.OPENAI_API_KEY }),
});

export const meetingsProcessing  = inngest.createFunction(
  { id: "meetings/processing" },
  { event: "meetings/processing" },
  async ({ event, step }) => {
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
        .in("id", speakerIds);

      const { data: agentSpeakers } = await supabase
        .from("agents")
        .select("*")
        .in("id", speakerIds);

      const speakers = [...(userSpeakers ?? []), ...(agentSpeakers ?? [])];

      return transcript.map((item) => {
        const speaker = speakers.find((speaker) => speaker.id === item.speaker_id);

        if (!speaker) {
          return {
            ...item,
            user: {
              name: "Unknown",
            },
          };
        };

        return {
          ...item,
          user: {
            name: speaker.name,
          },
        };
      });
    });

    const { output } = await summarizer.run(
      "Summarize the following transcript: " + JSON.stringify(transcriptWithSpeakers)
    );

    const summary = output.find(
      (msg): msg is TextMessage => msg.type === "text"
    )?.content;

    if (!summary) {
      throw new Error("No summary generated by agent");
    }

    await step.run("save-summary", async () => {
      const summary = (output[0] as TextMessage).content as string;

      const { error } = await supabase
        .from("meetings")
        .update({
          summary,
          status: "completed",
        })
        .eq("id", event.data.meetingId);

      if (error) throw error;
    });
  },
);
