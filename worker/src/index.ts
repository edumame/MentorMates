import express, { Request, Response } from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { StreamClient } from "@stream-io/node-sdk";
import { RealtimeClient } from "@stream-io/openai-realtime-api";

type SessionRecord = {
  realtimeClient: RealtimeClient;
  intervalId: ReturnType<typeof setInterval> | null;
  lastUpdatedAt?: string | null;
  lastSummary?: string | null;
  lastPushedAt?: number;
  paused?: boolean;
};

type RealtimeVoice = string | { id: string };

function normalizeRealtimeVoice(input: unknown): RealtimeVoice | undefined {
  if (typeof input !== "string") return undefined;

  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // OpenAI custom voice IDs are passed as voice objects: { id: "voice_..." }
  if (trimmed.startsWith("voice_")) {
    return { id: trimmed };
  }

  // Built-in voices are simple string names.
  return trimmed.toLowerCase();
}

// function wsSend(realtimeClient: RealtimeClient, event: any) {
//   const ws = realtimeClient?.realtime?.ws;
//   if (!ws) throw new Error("Realtime WS missing");
//   if (ws.readyState !== 1)
//     throw new Error(`Realtime WS not open (state=${ws.readyState})`);
//   ws.send(JSON.stringify(event));
// }

// function injectScreenAsUserMessage(
//   realtimeClient: RealtimeClient,
//   text: string
// ) {
//   wsSend(realtimeClient, {
//     type: "conversation.item.create",
//     item: {
//       type: "message",
//       role: "user",
//       content: [{ type: "input_text", text }],
//     },
//   });
// }

const app = express();

// Configure CORS to allow requests from your frontend
const allowedOrigins = [
  process.env.FRONTEND_URL,
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE ??
  "";

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

const streamVideo = new StreamClient(
  process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY || "",
  process.env.STREAM_VIDEO_SECRET_KEY || ""
);

const sessions = new Map<string, SessionRecord>();

const captionReady = new Set<string>();
const captionStore = new Map<string, { text: string; updatedAt: number }>();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post("/session/start", async (req: Request, res: Response) => {
  const { meetingId, callId, agentUserId, instructions, voice } = req.body || {};
  try {
    if (!meetingId || !agentUserId || !callId)
      return res.status(400).json({ error: "missing params" });

    // Stop existing if present (keyed by meetingId)
    if (sessions.has(meetingId)) {
      const existing = sessions.get(meetingId)!;
      if (existing.intervalId) clearInterval(existing.intervalId);
      try {
        existing.realtimeClient?.disconnect?.();
      } catch {}
      sessions.delete(meetingId);
    }

    setTimeout(() => {
      captionReady.add(meetingId);
    }, 3000);

    const call = streamVideo.video.call("default", callId);

    const realtimeClient: RealtimeClient = await streamVideo.video.connectOpenAi({
      call,
      openAiApiKey: process.env.OPENAI_API_KEY || "",
      agentUserId,
    });

    // Agent caption buffer - accumulates text deltas across the response
    let outputBuffer = "";
    let currentSentenceIndex = 0;
    let sentenceTimeouts: NodeJS.Timeout[] = [];
    let firstSentenceShown = false;
    let firstSentenceShownAt = 0;

    // Estimate speaking duration based on word count (roughly 3 words per second to stay ahead of audio)
    const estimateSpeakingDuration = (text: string): number => {
      const words = text.trim().split(/\s+/).length;
      const duration = (words / 3) * 1000; // Convert to milliseconds
      // Minimum 800ms per sentence for quick transitions
      return Math.max(duration, 800);
    };

    // Progressive sentence display: show one sentence at a time with speaking-speed delays
    const scheduleSentenceDisplay = () => {
      // Clear any existing timeouts
      sentenceTimeouts.forEach(clearTimeout);
      sentenceTimeouts = [];

      // Split into sentences
      const sentences = outputBuffer.match(/[^.!?]+[.!?]+/g) || [outputBuffer];

      if (!sentences || sentences.length === 0) {
        return;
      }

      // If first sentence was already shown, start from second sentence
      const startIndex = firstSentenceShown ? 1 : 0;
      let cumulativeDelay = 0;
      let totalDuration = 0;

      // Calculate total duration
      sentences.forEach((sentence) => {
        totalDuration += estimateSpeakingDuration(sentence);
      });

      // If first sentence was shown, calculate how much time is left before second sentence
      if (firstSentenceShown && sentences.length > 0) {
        const firstSentenceDuration = estimateSpeakingDuration(sentences[0]);
        const timeSinceFirstShown = Date.now() - firstSentenceShownAt;
        const remainingTime = Math.max(0, firstSentenceDuration - timeSinceFirstShown);
        cumulativeDelay = remainingTime;
      }

      // Schedule sentence displays (skip first if already shown)
      sentences.forEach((sentence, index) => {
        if (index < startIndex) return; // Skip first sentence if already shown

        const speakingDuration = estimateSpeakingDuration(sentence);

        const timeout = setTimeout(() => {
          // Show this sentence
          captionStore.set(meetingId, {
            text: sentence.trim(),
            updatedAt: Date.now(),
          });
          currentSentenceIndex = index;
        }, cumulativeDelay);

        sentenceTimeouts.push(timeout);
        cumulativeDelay += speakingDuration;
      });

      // Schedule caption clear as a final "display" with empty string
      // Add 4 seconds buffer to ensure caption stays visible through end of speech
      const clearDelay = totalDuration + 4000;

      const clearDisplayTimeout = setTimeout(() => {
        captionStore.set(meetingId, {
          text: "",
          updatedAt: Date.now(),
        });
      }, clearDelay); // Clear 4 seconds after last sentence

      sentenceTimeouts.push(clearDisplayTimeout);
    };

    // Intercept WebSocket messages to capture agent text in real-time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (realtimeClient.realtime as any).ws;
    if (ws) {
      const originalOnMessage = ws.onmessage;
      ws.onmessage = (event: MessageEvent) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = JSON.parse(event.data) as any;

          // Clear caption when agent starts a new response
          if (data.type === "response.created" || data.type === "response.output_item.added") {
            // Clear any scheduled sentence displays
            sentenceTimeouts.forEach(clearTimeout);
            sentenceTimeouts = [];

            captionStore.set(meetingId, {
              text: "",
              updatedAt: Date.now(),
            });
            outputBuffer = "";
            currentSentenceIndex = 0;
            firstSentenceShown = false;
            firstSentenceShownAt = 0;
          }

          // Capture agent text as it's generated
          if (data.type === "response.audio_transcript.delta") {
            outputBuffer += data.delta || "";

            // Show first sentence immediately as soon as we detect it
            if (!firstSentenceShown) {
              const firstSentenceMatch = outputBuffer.match(/^[^.!?]+[.!?]+/);
              if (firstSentenceMatch) {
                const firstSentence = firstSentenceMatch[0];
                const now = Date.now();
                captionStore.set(meetingId, {
                  text: firstSentence.trim(),
                  updatedAt: now,
                });
                firstSentenceShown = true;
                firstSentenceShownAt = now;
              }
            }
          } else if (data.type === "response.audio_transcript.done") {
            // Now that we have all the text, schedule sentence-by-sentence display
            // This syncs captions with speaking speed
            scheduleSentenceDisplay();
          }
        } catch {
          // Ignore non-JSON messages
        }

        // Call original handler to maintain SDK functionality
        if (originalOnMessage) {
          originalOnMessage.call(ws, event);
        }
      };
    }

    const sessionVoice = normalizeRealtimeVoice(voice);
    const sessionUpdate: Record<string, unknown> = {
      instructions,
      input_audio_transcription: { model: "whisper-1" },
      // Default to paused: user speaks first, then resumes to get a response.
      turn_detection: null,
    };
    if (sessionVoice) sessionUpdate.voice = sessionVoice;

    realtimeClient.updateSession(sessionUpdate as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const record: SessionRecord = {
      realtimeClient,
      intervalId: null,
      lastUpdatedAt: null,
      lastSummary: null,
      paused: true,
    };
    sessions.set(meetingId, record);

    // Somewhere near session start
    const baseInstructions = `${instructions}

      SCREEN CONTEXT POLICY:
      - You receive up-to-date context about the shared screen via internal messages prefixed with "[Screen]".
      - Treat the most recent [Screen] message as the authoritative representation of what is currently on the screen.
      - Answer questions about the screen naturally and confidently, as if you can see it.
      - Do NOT mention technical limitations, summaries, or how the screen information is obtained unless explicitly asked.

    `;

    // Poll loop
    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from("meeting_screen_context")
          .select("summary, updated_at")
          .eq("meeting_id", meetingId)
          .maybeSingle();

        if (error || !data) return;

        const summary = (data.summary || "").trim();
        const updatedAt = data.updated_at;

        if (!summary) return;
        if (summary === "No meaningful change") return;

        const changed =
          !record.lastUpdatedAt ||
          new Date(updatedAt) > new Date(record.lastUpdatedAt) ||
          summary !== record.lastSummary;

        if (!changed) return;

        // (optional) throttle: don’t update session more than once every 2s
        const now = Date.now();
        if (record.lastPushedAt && now - record.lastPushedAt < 2000) return;

        const screen = summary.startsWith("[Screen]")
          ? summary
          : `[Screen] ${summary}`;

        console.log(`Screen summary: ${screen.slice(0, 120)}`);

        // put it into the conversation as if the user said it
        // injectScreenAsUserMessage(realtimeClient, screen);
        // console.log(
        //   `[${meetingId}] injected user msg: ${screen.slice(0, 120)}`
        // );

        try {
          // Keep pause/resume sticky even when screen context updates.
          realtimeClient.updateSession({
            instructions: `${baseInstructions}\n\nLatest shared screen:\n${screen}\n`,
            turn_detection: record.paused ? null : { type: "server_vad" },
          });
          console.log(
            `[${meetingId}] updateSession OK: ${screen.slice(0, 120)}`
          );
        } catch (e) {
          console.error(`[${meetingId}] updateSession FAIL`, e);
        }

        record.lastUpdatedAt = updatedAt;
        record.lastSummary = summary;
        record.lastPushedAt = now;
      } catch (err) {
        console.error("poll error", err);
      }
    };

    const id = setInterval(poll, 2000);
    record.intervalId = id;

    // run one immediately
    poll();

    res.json({ ok: true });
  } catch (err) {
    console.error("/session/start error", err);
    res.status(500).json({ error: "internal" });
  }
});

app.post("/session/stop", async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.body || {};
    if (!meetingId) return res.status(400).json({ error: "missing meetingId" });

    const record = sessions.get(meetingId);
    if (!record) return res.json({ ok: true });

    if (record.intervalId) clearInterval(record.intervalId);
    try {
      record.realtimeClient?.disconnect?.();
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (record.realtimeClient as any)?.close?.();
      } catch {}
    }

    sessions.delete(meetingId);
    res.json({ ok: true });
  } catch (err) {
    console.error("/session/stop error", err);
    res.status(500).json({ error: "internal" });
  }
});

app.post("/session/pause", async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.body || {};
    if (!meetingId) return res.status(401).json({ error: "missing meetingId" });

    const record = sessions.get(meetingId);
    if (!record) return res.status(402).json({ error: "session not found" });
    const realtimeClient = record?.realtimeClient;
    if (!realtimeClient)
      return res.status(404).json({ error: "realtime client not found" });

    // send an update to the session to disable automatic response generation but keep VAD enabled
    try {
      record.paused = true;
      realtimeClient.realtime.send("session.update", {
        session: {
          turn_detection: null,
        },
      });
      realtimeClient.realtime.send("output_audio_buffer.clear", {});
      return res.json({ ok: true, paused: true });
    } catch (err) {
      console.error("/session/pause error on session update", err);
      console.log(err);
      res.status(501).json({ error: "internal" });
    }
  } catch (err) {
    console.error("/session/pause error", err);
    console.log(err);
    res.status(500).json({ error: "internal" });
  }
});

app.post("/session/resume", async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.body || {};
    if (!meetingId) return res.status(401).json({ error: "missing meetingId" });

    const record = sessions.get(meetingId);
    if (!record) return res.status(402).json({ error: "session not found" });

    const realtimeClient = record?.realtimeClient;
    if (!realtimeClient)
      return res.status(404).json({ error: "realtime client not found" });

    try {  
      record.paused = false;
      if (!captionReady.has(meetingId)) {
        return res.json({ ok: false, waitingForCaptions: true });
      }
      realtimeClient.realtime.send("input_audio_buffer.commit", {});
      realtimeClient.realtime.send("response.create", {});
      // realtimeClient.createResponse()
      realtimeClient.realtime.send("input_audio_buffer.clear", {});
      realtimeClient.updateSession({
        turn_detection: ({
          type: "server_vad",
        }),
      });
    } catch (err) {
      console.error("/session/resume error on session update", err);
      res.status(500).json({ error: "internal" });
    }
    return res.json({ ok: true, paused: false });
  } catch (err) {
    console.error("/session/resume error", err);
    res.status(500).json({ error: "internal" });
  }
});

// SSE endpoint for real-time caption streaming
app.get("/captions/stream", (req, res) => {
  const meetingId = req.query.meetingId as string;

  if (!meetingId) {
    return res.status(400).json({ error: "meetingId required" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Track last sent caption to avoid duplicates
  let lastSentText = "";
  let lastSentTime = 0;

  // Send initial caption
  const initialCaption = captionStore.get(meetingId);
  if (initialCaption) {
    res.write(`data: ${JSON.stringify({ text: initialCaption.text, updatedAt: initialCaption.updatedAt })}\n\n`);
    lastSentText = initialCaption.text;
    lastSentTime = initialCaption.updatedAt;
  }

  // Check for updates and push only when changed
  const interval = setInterval(() => {
    const caption = captionStore.get(meetingId);
    if (caption && (caption.text !== lastSentText || caption.updatedAt !== lastSentTime)) {
      res.write(`data: ${JSON.stringify({ text: caption.text, updatedAt: caption.updatedAt })}\n\n`);
      lastSentText = caption.text;
      lastSentTime = caption.updatedAt;
    }
  }, 100);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(interval);
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`worker listening on ${PORT}`);
});
