import JSONL from "jsonl-parse-stringify";
import { inngest } from "@/lib/inngest/client";
import { createAgent, openai, TextMessage } from "@inngest/agent-kit";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const summarizer = createAgent({
  name: "summarizer",
  system: `
    Use the following markdown structure for every output and make sure the sections are ordered (Overview, Additional Ideas, Next Steps, System Prompt, Pitch Feedback):

    Overview

    Here is how I understand your idea. You are making a Christmas gift for a close friend, and instead of buying something, you want to design something personal. Because you love board games and play them often, you want to create a Christmas themed board game just for him. The game itself is the gift. It is playful, thoughtful, and reflects who you are and how you show care. The most compelling part is that this is not about a generic holiday product. It is about friendship, shared play, and designing an experience rather than an object.

    Overall Score

    78 / 100

    This is a strong early pitch. The heart of the idea is very clear and emotionally grounded. What is missing right now is clarity around the game itself. What kind of game it is, how it plays, and why this specific game will delight your friend. With a bit more structure, this could become a very compelling design pitch.

    Score Breakdown

    Problem Clarity
      •	Score: 70
      •	What's Working Well:
      •	You clearly show that you want to avoid generic gifts and make something meaningful.
      •	The motivation comes from a real relationship, which makes it feel authentic.
      •	How to Improve Next Time:
      •	Name the problem in one sentence. For example, it is hard to find gifts that feel truly personal.
      •	Briefly explain why existing gifts or games do not fully solve this for you.

    Solution Clarity
      •	Score: 65
      •	What's Working Well:
      •	The idea of a Christmas board game as a gift is creative and memorable.
      •	Tying it to something you already love doing makes the solution feel natural.
      •	How to Improve Next Time:
      •	Describe the core mechanic of the game. Is it cooperative, competitive, story based, or puzzle driven.
      •	Explain what makes it specifically Christmas themed beyond visuals.

    User Value and Impact
      •	Score: 85
      •	What's Working Well:
      •	The gift is deeply personal and experience driven.
      •	Playing the game together creates shared memories, not just ownership.
      •	How to Improve Next Time:
      •	Say how you imagine your friend feeling when they open and play the game.
      •	Share one concrete moment of delight you are designing for.

    Storytelling and Delivery
      •	Score: 82
      •	What's Working Well:
      •	The story feels warm, casual, and genuine.
      •	Your passion for board games comes through clearly.
      •	How to Improve Next Time:
      •	Add a simple beginning, middle, and end to the story.
      •	End with a clear statement of what you are making and why it matters.

    Improvement Focus

    Before your next pitch, focus on these three things:
      1.	Clearly describe the game itself in one minute. Genre, rules, and play time.
      2.	Articulate the emotional goal of the gift. What feeling are you designing for.
      3.	Show one concrete example of gameplay or a sample card, board, or rule.

    ⸻

    Suggested Next Steps for the Gift

    Next Steps
      •	Decide on one core mechanic. For example cooperative storytelling, light strategy, or party style prompts.
      •	Choose a personal hook. Inside jokes, shared memories, or places you both know.
      •	Create a simple prototype. Paper cards, a printed board, or even a digital version.
      •	Playtest it once with a friend and refine only one thing.

    Additional Gift Ideas to Pair With the Game
      •	A handwritten rulebook with a personal note on the first page.
      •	Custom game pieces that represent shared memories.
      •	A Christmas envelope that contains surprise mini expansions.
      •	A QR code that links to a short video or message from you explaining the game.

    ⸻

    System Prompt for Lovable PRD

    You can paste this directly into Lovable as a product requirement prompt:

    You are a game designer helping me create a small, personal Christmas board game as a gift for a close friend. 
    The game should be easy to learn, playable in 20 to 40 minutes, and designed for 2 players. 
    The theme is Christmas and friendship, with a warm, playful tone.
    Include a clear core mechanic, simple rules, and opportunities for shared storytelling or light strategy.
    Design the game so it feels personal and meaningful rather than competitive.
    Output should include:
    - Game concept and goal
    - Core mechanics
    - Components list
    - Setup instructions
    - Basic rules
    - One example turn
    Optimize for emotional impact and ease of prototyping.

    This idea already has heart. With a bit more structure, it can become a gift your friend will never forget.

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
