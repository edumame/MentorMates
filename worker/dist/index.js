"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const node_sdk_1 = require("@stream-io/node-sdk");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '2mb' }));
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const streamVideo = new node_sdk_1.StreamClient(process.env.STREAM_VIDEO_API_KEY || '', process.env.STREAM_VIDEO_SECRET_KEY || '');
const sessions = new Map();
function trySendUserMessage(realtimeClient, content) {
    const attempts = [
        async () => realtimeClient.send({ type: 'message', role: 'user', content }),
        async () => realtimeClient.sendUserMessage && realtimeClient.sendUserMessage(content),
        async () => realtimeClient.sendMessage && realtimeClient.sendMessage({ role: 'user', content }),
    ];
    return (async () => {
        for (const fn of attempts) {
            try {
                const res = await fn();
                if (res !== undefined)
                    return res;
            }
            catch (e) {
                // try next
            }
        }
        throw new Error('All send attempts failed');
    })();
}
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.post('/session/start', async (req, res) => {
    try {
        const { meetingId, agentUserId, instructions } = req.body || {};
        if (!meetingId || !agentUserId)
            return res.status(400).json({ error: 'missing params' });
        // Stop existing if present
        if (sessions.has(meetingId)) {
            const existing = sessions.get(meetingId);
            if (existing.intervalId)
                clearInterval(existing.intervalId);
            try {
                existing.realtimeClient?.disconnect?.();
            }
            catch { }
            sessions.delete(meetingId);
        }
        const call = streamVideo.video.call('default', meetingId);
        const realtimeClient = await streamVideo.video.connectOpenAi({
            call,
            openAiApiKey: process.env.OPENAI_API_KEY || '',
            agentUserId,
        });
        await realtimeClient.updateSession({
            instructions,
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: { type: 'server_vad' },
        });
        const record = { realtimeClient, intervalId: null, lastUpdatedAt: null, lastSummary: null };
        sessions.set(meetingId, record);
        // Poll loop
        const poll = async () => {
            try {
                const { data, error } = await supabase
                    .from('meeting_screen_context')
                    .select('summary, updated_at')
                    .eq('meeting_id', meetingId)
                    .maybeSingle();
                if (error || !data)
                    return;
                const summary = (data.summary || '').trim();
                const updated_at = data.updated_at;
                if (!summary)
                    return;
                if (summary === 'No meaningful change')
                    return;
                const lastUpdated = record.lastUpdatedAt;
                const lastSummary = record.lastSummary;
                const changed = (!lastUpdated || new Date(updated_at) > new Date(lastUpdated)) || summary !== lastSummary;
                if (!changed)
                    return;
                // send as user message
                try {
                    await trySendUserMessage(realtimeClient, summary);
                    record.lastUpdatedAt = updated_at;
                    record.lastSummary = summary;
                }
                catch (err) {
                    console.warn('failed to send user message', err);
                }
            }
            catch (err) {
                console.error('poll error', err);
            }
        };
        const id = setInterval(poll, 5000);
        record.intervalId = id;
        // run one immediately
        poll();
        res.json({ ok: true });
    }
    catch (err) {
        console.error('/session/start error', err);
        res.status(500).json({ error: 'internal' });
    }
});
app.post('/session/stop', async (req, res) => {
    try {
        const { meetingId } = req.body || {};
        if (!meetingId)
            return res.status(400).json({ error: 'missing meetingId' });
        const record = sessions.get(meetingId);
        if (!record)
            return res.json({ ok: true });
        if (record.intervalId)
            clearInterval(record.intervalId);
        try {
            await record.realtimeClient?.disconnect?.();
        }
        catch (e) {
            try {
                await record.realtimeClient?.close?.();
            }
            catch { }
        }
        sessions.delete(meetingId);
        res.json({ ok: true });
    }
    catch (err) {
        console.error('/session/stop error', err);
        res.status(500).json({ error: 'internal' });
    }
});
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`worker listening on ${PORT}`);
});
