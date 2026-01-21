import express, { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { StreamClient } from '@stream-io/node-sdk'

type SessionRecord = {
  realtimeClient: any;
  intervalId: ReturnType<typeof setInterval> | null;
  lastUpdatedAt?: string | null;
  lastSummary?: string | null;
  lastPushedAt?: number;
}

function wsSend(realtimeClient: any, event: any) {
  const ws = realtimeClient?.realtime?.ws;
  if (!ws) throw new Error("Realtime WS missing");
  if (ws.readyState !== 1) throw new Error(`Realtime WS not open (state=${ws.readyState})`);
  ws.send(JSON.stringify(event));
}

function injectScreenAsUserMessage(realtimeClient: any, text: string) {
  wsSend(realtimeClient, {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    },
  });
}

const app = express()
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT ? Number(process.env.PORT) : 4001

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE ??
  "";

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '')

const streamVideo = new StreamClient(process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY || '', process.env.STREAM_VIDEO_SECRET_KEY || '')

const sessions = new Map<string, SessionRecord>()

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

app.post('/session/start', async (req: Request, res: Response) => {
  try {
    const { meetingId, callId, agentUserId, instructions } = req.body || {}
    if (!meetingId || !agentUserId || !callId) return res.status(400).json({ error: 'missing params' })

    // Stop existing if present (keyed by meetingId)
    if (sessions.has(meetingId)) {
      const existing = sessions.get(meetingId)!
      if (existing.intervalId) clearInterval(existing.intervalId)
      try { existing.realtimeClient?.disconnect?.() } catch {}
      sessions.delete(meetingId)
    }

    const call = streamVideo.video.call('default', callId)

    let realtimeClient: any
    try {
      realtimeClient = await streamVideo.video.connectOpenAi({
        call,
        openAiApiKey: process.env.OPENAI_API_KEY || '',
        agentUserId,
      })
      console.log("realtimeClient keys:", Object.keys(realtimeClient));
      console.log("conversation keys:", Object.keys(realtimeClient.conversation || {}));
      console.log("realtime keys:", Object.keys(realtimeClient.realtime || {}));
    } catch (e) {
      console.error('session/start failed', { meetingId, callId, err: String(e) })
      return res.status(500).json({ ok: false, error: String(e) })
    }

    await realtimeClient.updateSession({
      instructions,
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: { type: 'server_vad' },
    })

    realtimeClient.on("error", (error: Error) => {
      console.log(`received error`, error);
    });

    const record: SessionRecord = { realtimeClient, intervalId: null, lastUpdatedAt: null, lastSummary: null }
    sessions.set(meetingId, record)

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
          (!record.lastUpdatedAt || new Date(updatedAt) > new Date(record.lastUpdatedAt)) ||
          summary !== record.lastSummary;

        if (!changed) return;

        // (optional) throttle: don’t update session more than once every 2s
        const now = Date.now();
        if (record.lastPushedAt && now - record.lastPushedAt < 2000) return;

        const screen = summary.startsWith("[Screen]") ? summary : `[Screen] ${summary}`;

        // put it into the conversation as if the user said it
        injectScreenAsUserMessage(realtimeClient, screen);
        console.log(`[${meetingId}] injected user msg: ${screen.slice(0, 120)}`);


        try {
          await realtimeClient.updateSession({
            instructions: `${baseInstructions}\n\nLatest shared screen:\n${screen}\n`,
          });
          console.log(`[${meetingId}] updateSession OK: ${screen.slice(0, 120)}`);
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


    const id = setInterval(poll, 5000)
    record.intervalId = id

    // run one immediately
    poll()

    res.json({ ok: true })
  } catch (err) {
    console.error('/session/start error', err)
    res.status(500).json({ error: 'internal' })
  }
})

app.post('/session/stop', async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.body || {}
    if (!meetingId) return res.status(400).json({ error: 'missing meetingId' })

    const record = sessions.get(meetingId)
    if (!record) return res.json({ ok: true })

    if (record.intervalId) clearInterval(record.intervalId)
    try {
      await record.realtimeClient?.disconnect?.()
    } catch (e) {
      try { await record.realtimeClient?.close?.() } catch {}
    }

    sessions.delete(meetingId)
    res.json({ ok: true })
  } catch (err) {
    console.error('/session/stop error', err)
    res.status(500).json({ error: 'internal' })
  }
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`worker listening on ${PORT}`)
})
