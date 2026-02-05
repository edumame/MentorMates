import express, { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { StreamClient } from "@stream-io/node-sdk";
import { RealtimeClient } from "@stream-io/openai-realtime-api";

type SessionRecord = {
  realtimeClient: RealtimeClient;
  intervalId: ReturnType<typeof setInterval> | null;
  lastUpdatedAt?: string | null;
  lastSummary?: string | null;
  lastPushedAt?: number;
};

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
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

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
  const { meetingId, callId, agentUserId, instructions } = req.body || {};
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
    console.log("realtimeClient keys:", Object.keys(realtimeClient));
    console.log(
      "conversation keys:",
      Object.keys(realtimeClient.conversation || {})
    );
    console.log("realtime keys:", Object.keys(realtimeClient.realtime || {}));

    // Check if there's a WebSocket we can listen to directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (realtimeClient.realtime as any).ws;
    console.log(`[${meetingId}] WebSocket exists:`, !!ws);
    if (ws) {
      console.log(`[${meetingId}] WebSocket readyState:`, ws.readyState);
      console.log(`[${meetingId}] WebSocket keys:`, Object.keys(ws));

      // Listen to raw WebSocket messages
      const originalOnMessage = ws.onmessage;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ws.onmessage = (event: MessageEvent) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = JSON.parse(event.data) as any;
          console.log(`[${meetingId}] RAW WS MESSAGE:`, data.type);

          // Handle transcript events directly from WebSocket
          if (data.type === "response.audio_transcript.delta") {
            outputBuffer += data.delta || "";
            console.log(`[${meetingId}] WS Caption delta: "${outputBuffer}"`);
            captionStore.set(meetingId, {
              text: outputBuffer,
              updatedAt: Date.now(),
            });
          } else if (data.type === "response.audio_transcript.done") {
            const text = data.transcript || outputBuffer || "";
            console.log(`[${meetingId}] WS Caption done: "${text}"`);
            captionStore.set(meetingId, {
              text,
              updatedAt: Date.now(),
            });
            outputBuffer = "";
          }
        } catch {
          console.log(`[${meetingId}] WS message (not JSON):`, event.data?.substring?.(0, 100));
        }

        // Call original handler if it exists
        if (originalOnMessage) {
          originalOnMessage.call(ws, event);
        }
      };

      console.log(`[${meetingId}] Raw WebSocket listener attached`);
    }

    // Check if realtime has an 'on' method
    console.log(`[${meetingId}] realtime.on exists:`, typeof realtimeClient.realtime.on);
    // @ts-expect-error - checking for alternative event methods
    console.log(`[${meetingId}] realtime.addEventListener exists:`, typeof realtimeClient.realtime.addEventListener);

    // keep a persistent buffer across realtime message events so deltas accumulate
    let outputBuffer = "";

    console.log(`[${meetingId}] Setting up message listener...`);

    // Try listening to all possible events to see which ones fire
    const testEvents = ["message", "event", "data", "response", "conversation.item.appended"];
    testEvents.forEach(eventName => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (realtimeClient.realtime as any).on?.(eventName, (data: any) => {
        console.log(`[${meetingId}] Received REALTIME event on '${eventName}':`, typeof data, data?.type || "no type");
      });
    });

    // Also try listening on conversation object
    if (realtimeClient.conversation) {
      console.log(`[${meetingId}] Setting up conversation listeners...`);
      // @ts-expect-error - checking for event methods
      if (typeof realtimeClient.conversation.on === "function") {
        testEvents.forEach(eventName => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (realtimeClient.conversation as any).on?.(eventName, (data: any) => {
            console.log(`[${meetingId}] Received CONVERSATION event on '${eventName}':`, typeof data, data?.type || "no type");
          });
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtimeClient.realtime.on("message", (event: any) => {
      try {
        // Debug: log ALL event types first to understand what we're receiving
        console.log(`[${meetingId}] Event type:`, event.type);

        // Debug: log specific events with more detail
        if (event.type?.includes("output_text") || event.type?.includes("audio") || event.type?.includes("transcript")) {
          console.log(`[${meetingId}] Realtime event details:`, event.type, JSON.stringify({
            delta: event.delta,
            text: event.text,
            transcript: event.transcript,
            output: event.output,
          }));
        }

        // Agent text transcript events (correct OpenAI Realtime API event names)
        if (event.type === "response.audio_transcript.delta") {
          // accumulate partial text from transcript
          outputBuffer += event.delta || "";
          console.log(`[${meetingId}] Caption delta, buffer now: "${outputBuffer}"`);
          // Immediately store the accumulated caption so client can see it in real-time
          captionStore.set(meetingId, {
            text: outputBuffer,
            updatedAt: Date.now(),
          });
        }

        if (event.type === "response.audio_transcript.done") {
          // finalize and store the caption text for this meeting
          const text = event.transcript || outputBuffer || "";
          console.log(`[${meetingId}] Caption done, final text: "${text}"`);
          captionStore.set(meetingId, {
            text,
            updatedAt: Date.now(),
          });
          // clear buffer for next response
          outputBuffer = "";
        }

        // Also try the old event names in case they exist
        if (event.type === "response.output_text.delta") {
          outputBuffer += event.delta || "";
          console.log(`[${meetingId}] Caption delta (output_text), buffer now: "${outputBuffer}"`);
          captionStore.set(meetingId, {
            text: outputBuffer,
            updatedAt: Date.now(),
          });
        }

        if (event.type === "response.output_text.done") {
          const text = outputBuffer || "";
          console.log(`[${meetingId}] Caption done (output_text), final text: "${text}"`);
          captionStore.set(meetingId, {
            text,
            updatedAt: Date.now(),
          });
          outputBuffer = "";
        }
      } catch (err) {
        console.error(`[${meetingId}] Error in message handler:`, err);
      }
    });

    console.log(`[${meetingId}] Message listener set up successfully`);

    realtimeClient.updateSession({
      instructions,
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: { type: "server_vad" },
    });

    const record: SessionRecord = {
      realtimeClient,
      intervalId: null,
      lastUpdatedAt: null,
      lastSummary: null,
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
          realtimeClient.updateSession({
            instructions: `${baseInstructions}\n\nLatest shared screen:\n${screen}\n`,
            turn_detection: { type: "server_vad" },
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
      })
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

app.get("/captions/receive", (req, res) => {
  const meetingId = req.query.meetingId as string;
  if (!meetingId) {
    return res.status(400).json({ ok: false });
  }

  const rec = captionStore.get(meetingId) || { text: "", updatedAt: 0 };
  res.json({ ok: true, text: rec.text, updatedAt: rec.updatedAt });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`worker listening on ${PORT}`);
});
