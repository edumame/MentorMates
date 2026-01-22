import express, { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { StreamClient, OwnCapability } from '@stream-io/node-sdk'
import { RealtimeClient } from '@stream-io/openai-realtime-api'

type SessionRecord = {
  realtimeClient: RealtimeClient;
  intervalId: ReturnType<typeof setInterval> | null;
  lastUpdatedAt?: string | null;
  lastSummary?: string | null;
  lastPushedAt?: number;
  // new fields for pause/resume support
  paused?: boolean;
  baseInstructions?: string;
  lastPrompt?: string | null;
  // reconnection data
  callId?: string;
  callType?: string;
  callCid?: string;
  agentUserId?: string;
  rawInstructions?: string;
}

type WebsocketLike = { readyState?: number; send: (s: string) => void }
type RealtimeWrapper = { realtime?: { ws?: WebsocketLike } }
type RealtimeClientLike = {
  interrupt?: () => Promise<void> | void
  cancel?: () => Promise<void> | void
  stop?: () => Promise<void> | void
  realtime?: {
    interrupt?: () => Promise<void> | void
    cancel?: () => Promise<void> | void
    stop?: () => Promise<void> | void
    ws?: WebsocketLike
  }
  disconnect?: () => Promise<void> | void
  updateSession?: (opts: Record<string, unknown>) => Promise<void> | void
  close?: () => Promise<void> | void
}

type CallModeration = {
  revokePermissions?: (userId: string, perms: string[]) => Promise<void>
  grantPermissions?: (userId: string, perms: string[]) => Promise<void>
  updateUserPermissions?: (...args: unknown[]) => Promise<void>
}

function wsSend(realtimeClient: RealtimeClient, event: Record<string, unknown>) {
  const ws = (realtimeClient as unknown as RealtimeWrapper)?.realtime?.ws;
  if (!ws) throw new Error("Realtime WS missing");
  if (ws.readyState !== 1) throw new Error(`Realtime WS not open (state=${ws.readyState})`);
  ws.send(JSON.stringify(event));
}

function injectScreenAsUserMessage(realtimeClient: RealtimeClient, text: string) {
  wsSend(realtimeClient, {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    },
  });
}

// Helper to inspect websocket state
function getWsState(client: RealtimeClientLike | RealtimeWrapper): { ws?: WebsocketLike; readyState?: number; isOpen: boolean } {
  const ws = (client as RealtimeWrapper)?.realtime?.ws
  const readyState = ws?.readyState
  const isOpen = !!ws && readyState === 1
  return { ws, readyState, isOpen }
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

// Helper: connect (or reconnect) a realtime OpenAI client for a call
async function connectRealtimeSession({ callId, callType, agentUserId, instructions }: { callId: string; callType?: string; agentUserId: string; instructions: string; }): Promise<RealtimeClient> {
  const ct = callType || 'default'
  const call = streamVideo.video.call(ct, callId)
  const realtimeClient: RealtimeClient = await streamVideo.video.connectOpenAi({
    call,
    openAiApiKey: process.env.OPENAI_API_KEY || '',
    agentUserId,
  })

  try {
    await realtimeClient.updateSession({
      instructions,
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: { type: 'server_vad' },
    })
  } catch (e) {
    console.error('connectRealtimeSession: updateSession failed', e)
  }

  return realtimeClient
}

// Helper: start the poll loop for a meeting and attach intervalId to record
function startPollLoop(meetingId: string, record: SessionRecord) {
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

      const now = Date.now();
      if (record.lastPushedAt && now - record.lastPushedAt < 2000) return;

      const screen = summary.startsWith("[Screen]") ? summary : `[Screen] ${summary}`;

      if (record.paused) {
        console.log(`[${meetingId}] session paused — skipping injection`);
        record.lastUpdatedAt = updatedAt;
        record.lastSummary = summary;
        record.lastPushedAt = now;
        return;
      }

      // put it into the conversation as if the user said it
      try {
        injectScreenAsUserMessage(record.realtimeClient, screen);
        console.log(`[${meetingId}] injected user msg: ${screen.slice(0, 120)}`);
      } catch (e) {
        console.error(`[${meetingId}] injectScreenAsUserMessage failed`, e);
      }

      try {
        await record.realtimeClient.updateSession({
          instructions: `${record.baseInstructions || ''}\n\nLatest shared screen:\n${screen}\n`,
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

  if (record.intervalId) clearInterval(record.intervalId)
  const id = setInterval(poll, 5000)
  record.intervalId = id
  // run one immediately
  poll()
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

app.post('/session/start', async (req: Request, res: Response) => {
  const { meetingId, callId, callType, agentUserId, instructions } = req.body || {}
  try {
    if (!meetingId || !agentUserId || !callId) return res.status(400).json({ error: 'missing params' })

    // Stop existing if present (keyed by meetingId)
    if (sessions.has(meetingId)) {
      const existing = sessions.get(meetingId)!
      if (existing.intervalId) clearInterval(existing.intervalId)
      try { existing.realtimeClient?.disconnect?.() } catch {}
      sessions.delete(meetingId)
    }


    // Somewhere near session start
    const baseInstructions = `${instructions}

      SCREEN CONTEXT POLICY:
      - You receive up-to-date context about the shared screen via internal messages prefixed with "[Screen]".
      - Treat the most recent [Screen] message as the authoritative representation of what is currently on the screen.
      - Answer questions about the screen naturally and confidently, as if you can see it.
      - Do NOT mention technical limitations, summaries, or how the screen information is obtained unless explicitly asked.

    `;

    // initialize paused / last prompt from DB (fallback)
    let dbPaused = false
    let dbLastPrompt: string | null = null
    try {
      const { data: meetingRow, error: meetingErr } = await supabase
        .from('meetings')
        .select('agent_paused, last_agent_prompt')
        .eq('id', meetingId)
        .maybeSingle();

      if (!meetingErr && meetingRow) {
        dbPaused = meetingRow.agent_paused ?? false;
        dbLastPrompt = meetingRow.last_agent_prompt ?? null;
      }
    } catch (e) {
      console.error('failed to load meeting pause state', e);
    }

    // connect realtime client via helper
    const realtimeClient = await connectRealtimeSession({ callId, callType, agentUserId, instructions })

    // One-time discovery logging: list available methods on the client
    try {
      console.log('[session/start] realtimeClient keys=', Object.keys(realtimeClient || {}))
      console.log('[session/start] realtimeClient.realtime keys=', Object.keys((realtimeClient as unknown as RealtimeWrapper).realtime ?? {}))
      const callTypeStr = callType || 'default'
      const callCid = `${callTypeStr}:${callId}`
      console.log(`[session/start] callType=${callTypeStr} callCid=${callCid} callId=${callId} agentUserId=${agentUserId}`)
    } catch (e) {
      console.warn('session/start: failed to inspect realtimeClient', e)
    }

    const record: SessionRecord = {
      realtimeClient,
      intervalId: null,
      lastUpdatedAt: null,
      lastSummary: "",
      paused: dbPaused,
      baseInstructions: baseInstructions,
      lastPrompt: dbLastPrompt,
      callId,
      callType,
      callCid: `${callType || 'default'}:${callId}`,
      agentUserId,
      rawInstructions: instructions,
    }

    sessions.set(meetingId, record)

    // start poll loop
    startPollLoop(meetingId, record)

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
      try { await (record.realtimeClient as unknown as RealtimeClientLike)?.close?.() } catch {}
    }

    sessions.delete(meetingId)
    res.json({ ok: true })
  } catch (err) {
    console.error('/session/stop error', err)
    res.status(500).json({ error: 'internal' })
  }
})

// Pause the agent for a meeting: stop speaking and set paused state
app.post('/agent/pause', async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.body || {}
    console.log('PAUSE HIT', meetingId, 'hasSession=', sessions.has(meetingId))
    if (!meetingId) return res.status(400).json({ error: 'missing meetingId' })

    const record = sessions.get(meetingId)
    if (!record) return res.status(404).json({ ok: false })

    // persist paused state
    try {
      await supabase.from('meetings').update({ agent_paused: true }).eq('id', meetingId)
    } catch (e) {
      console.error('supabase update agent_paused true failed', e)
    }

    record.paused = true
    // inspect ws
    const { ws, readyState, isOpen } = getWsState(record.realtimeClient)
    console.log(`[${meetingId}] pause called; meetingId=${meetingId} callId=${record.callId} agentUserId=${record.agentUserId} ws present=${!!ws} readyState=${readyState}`)

    // Try to hard-mute at the call level so agent audio isn't published into Stream recordings/transcription
    let permissionOk = false
    try {
      if (record.callId && record.agentUserId) {
        const callCid = record.callCid || `${record.callType || 'default'}:${record.callId}`
        const payload = {
          call_cid: callCid,
          user_id: record.agentUserId,
          revoke_permissions: [OwnCapability.SEND_AUDIO],
        }
        console.log(`[${meetingId}] pause: callType=${record.callType || 'default'} callCid=${callCid} agentUserId=${record.agentUserId}`)
        console.log(`[${meetingId}] pause: updateUserPermissions payload=`, payload)
        try {
          await streamVideo.video.updateUserPermissions(payload as any)
          console.log(`[${meetingId}] updateUserPermissions revoke_permissions succeeded for ${record.agentUserId}`)
          permissionOk = true
        } catch (e) {
          console.warn(`[${meetingId}] updateUserPermissions revoke_permissions failed`, e)
        }
      } else {
        console.warn(`[${meetingId}] pause: missing callId or agentUserId, cannot change call-level permissions`, { callId: record.callId, agentUserId: record.agentUserId })
      }
    } catch (e) {
      console.warn(`[${meetingId}] pause: permission change attempt threw`, e)
    }

    // Best-effort: attempt to interrupt any ongoing speech/requests using supported SDK methods.
    try {
      const rc = record.realtimeClient as unknown as RealtimeClientLike
      if (rc) {
        try { await rc.interrupt?.(); } catch (e) { /* ignore */ }
        try { await rc.cancel?.(); } catch (e) { /* ignore */ }
        try { await rc.stop?.(); } catch (e) { /* ignore */ }
        // also try nested realtime object if present
        const nested = rc.realtime ?? {}
        try { await nested.interrupt?.(); } catch (e) { /* ignore */ }
        try { await nested.cancel?.(); } catch (e) { /* ignore */ }
        try { await nested.stop?.(); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn(`[${meetingId}] pause: interrupt/cancel/stop attempts failed`, e)
    }

    // NOTE: Do NOT send raw websocket events here (can cause protocol errors).
    // Use updateSession to enforce mute and disable turn detection so agent won't auto-start.
    let updateOk = false
    try {
      await record.realtimeClient.updateSession({
        instructions: `${record.baseInstructions || ''}\n\nSYSTEM: AGENT IS PAUSED. Do NOT speak or respond. Only listen.`,
        turn_detection: null as unknown as Record<string, unknown> | null,
      } as Record<string, unknown>)
      updateOk = true
    } catch (e) {
      console.warn('updateSession with turn_detection=null failed, trying {type:"none"}', e)
      try {
        await record.realtimeClient.updateSession({
          instructions: `${record.baseInstructions || ''}\n\nSYSTEM: AGENT IS PAUSED. Do NOT speak or respond. Only listen.`,
          turn_detection: { type: 'none' } as unknown as Record<string, unknown>,
        } as Record<string, unknown>)
        updateOk = true
      } catch (err2) {
        console.error('updateSession to paused instructions failed', err2)
      }
    }

    const { readyState: afterReadyState, isOpen: afterIsOpen } = getWsState(record.realtimeClient)
    console.log(`[${meetingId}] pause: updateSession succeeded=${updateOk} permissionMuted=${permissionOk} wsPresent=${!!afterIsOpen} readyState=${afterReadyState}`)

    // TODO: If we want to instantly cut audio mid-sentence in future, use supported SDK methods
    // (interrupt/cancel APIs) rather than sending raw protocol events.

    return res.json({ ok: true, paused: true, updateSessionOk: updateOk })
  } catch (err) {
    console.error('/agent/pause error', err)
    res.status(500).json({ error: 'internal' })
  }
})


// Resume the agent: restore instructions and optionally replay last prompt
app.post('/agent/resume', async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.body || {}
    if (!meetingId) return res.status(400).json({ error: 'missing meetingId' })

    const record = sessions.get(meetingId)
    if (!record) return res.status(404).json({ ok: false })

    const { ws, readyState, isOpen } = getWsState(record.realtimeClient)
    console.log(`RESUME HIT meetingId=${meetingId} callId=${record.callId} agentUserId=${record.agentUserId} wsReadyState=${readyState}`)

    if (!isOpen) {
      console.warn(`[${meetingId}] realtime ws not open, attempting reconnect`)

      // cleanup old client and poll
      if (record.intervalId) {
        clearInterval(record.intervalId)
        record.intervalId = null
      }
      try {
        await record.realtimeClient?.disconnect?.()
      } catch (e) {
        try { await (record.realtimeClient as unknown as RealtimeClientLike)?.close?.() } catch {}
      }

      // need callId and agentUserId to reconnect
      if (!record.callId || !record.agentUserId || !record.rawInstructions) {
        console.error(`[${meetingId}] missing reconnection data`, { callId: record.callId, agentUserId: record.agentUserId })
        return res.status(500).json({ error: 'missing reconnection data' })
      }

      try {
        const newClient = await connectRealtimeSession({ callId: record.callId as string, callType: record.callType, agentUserId: record.agentUserId as string, instructions: record.rawInstructions as string })
        record.realtimeClient = newClient
      } catch (e) {
        console.error(`[${meetingId}] reconnect failed`, e)
        return res.status(500).json({ error: 'reconnect failed' })
      }

      // restart poll loop
      startPollLoop(meetingId, record)
    }

    // Restore call-level SEND_AUDIO permission so agent can publish audio again
    let permissionRestoreOk = false
    try {
      if (record.callCid && record.agentUserId) {
        const payload = {
          call_cid: record.callCid,
          user_id: record.agentUserId,
          grant_permissions: [OwnCapability.SEND_AUDIO],
        }
        console.log(`[${meetingId}] resume: callType=${record.callType || 'default'} callCid=${record.callCid} agentUserId=${record.agentUserId}`)
        console.log(`[${meetingId}] resume: updateUserPermissions payload=`, payload)
        try {
          await streamVideo.video.updateUserPermissions(payload as any)
          console.log(`[${meetingId}] updateUserPermissions grant_permissions succeeded for ${record.agentUserId}`)
          permissionRestoreOk = true
        } catch (e) {
          console.warn(`[${meetingId}] updateUserPermissions grant_permissions failed`, e)
        }
      } else if (record.callId && record.agentUserId) {
        // fallback if callCid isn't present
        const callCid = `${record.callType || 'default'}:${record.callId}`
        const payload = { call_cid: callCid, user_id: record.agentUserId, grant_permissions: [OwnCapability.SEND_AUDIO] }
        console.log(`[${meetingId}] resume (fallback): callType=${record.callType || 'default'} callCid=${callCid} agentUserId=${record.agentUserId}`)
        try {
          await streamVideo.video.updateUserPermissions(payload as any)
          console.log(`[${meetingId}] updateUserPermissions grant_permissions succeeded (fallback) for ${record.agentUserId}`)
          permissionRestoreOk = true
        } catch (e) {
          console.warn(`[${meetingId}] updateUserPermissions grant_permissions failed (fallback)`, e)
        }
      } else {
        console.warn(`[${meetingId}] resume: missing callId or agentUserId, cannot restore call-level permissions`, { callId: record.callId, agentUserId: record.agentUserId })
      }
    } catch (e) {
      console.warn(`[${meetingId}] resume: permission restore attempt threw`, e)
    }

    // restore normal instructions AND restore turn detection (unmute)
    let unmuteOk = false
    try {
      await record.realtimeClient.updateSession({ instructions: record.baseInstructions || '', turn_detection: { type: 'server_vad' } as unknown as Record<string, unknown> } as Record<string, unknown>)
      unmuteOk = true
    } catch (e) {
      console.error('updateSession restore failed', e)
    }

    if (unmuteOk) {
      record.paused = false
    }

    // Optional: replay last prompt
    let promptToReplay = record.lastPrompt || null
    if (!promptToReplay) {
      try {
        const { data: meetingRow } = await supabase
          .from('meetings')
          .select('last_agent_prompt')
          .eq('id', meetingId)
          .maybeSingle()
        if (meetingRow && meetingRow.last_agent_prompt) promptToReplay = meetingRow.last_agent_prompt
      } catch (e) {
        console.error('supabase fetch last_agent_prompt failed', e)
      }
    }

    // Do NOT send raw websocket events to replay. Replay is disabled for stability.
    // If replay is desired later, implement it using supported SDK APIs (TODO).
    const replayed = false

    // persist paused=false if we unmuted
    try {
      if (unmuteOk) await supabase.from('meetings').update({ agent_paused: false }).eq('id', meetingId)
    } catch (e) {
      console.error('supabase update agent_paused false failed', e)
    }

    console.log(`[${meetingId}] resume: unmuteOk=${unmuteOk} permissionRestored=${permissionRestoreOk} wsReadyState=${getWsState(record.realtimeClient).readyState}`)
    return res.json({ ok: true, paused: !unmuteOk ? true : false, replayed, permissionRestored: permissionRestoreOk })
  } catch (err) {
    console.error('/agent/resume error', err)
    res.status(500).json({ error: 'internal' })
  }
})


// Set/update the last prompt for a meeting (persist in-memory and in supabase)
app.post('/agent/last-prompt', async (req: Request, res: Response) => {
  try {
    const { meetingId, prompt } = req.body || {}
    if (!meetingId) return res.status(400).json({ error: 'missing meetingId' })
    if (typeof prompt !== 'string') return res.status(400).json({ error: 'missing prompt' })

    const record = sessions.get(meetingId)
    if (record) record.lastPrompt = prompt

    try {
      await supabase.from('meetings').update({ last_agent_prompt: prompt }).eq('id', meetingId)
    } catch (e) {
      console.error('supabase update last_agent_prompt failed', e)
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('/agent/last-prompt error', err)
    res.status(500).json({ error: 'internal' })
  }
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`worker listening on ${PORT}`)
})
