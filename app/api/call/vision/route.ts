import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `You are summarizing a shared screen for a live meeting assistant. Describe only what's visible and important. Prefer UI text, error messages, numbers, button labels, and user actions. Ignore decoration. Keep it under 40 words. If nothing meaningful changed, respond exactly: 'No meaningful change'.`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { meetingId, ts, imageBase64 } = body || {}
    if (!meetingId || !imageBase64) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Call Responses API with multimodal input: one system text and one image input
    const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`

    // Try to create a concise multimodal request. Be tolerant of SDK shape differences.
    const resp = await openai.responses.create({
        model: process.env.OPENAI_RESPONSES_MODEL || "gpt-4o-mini",
        input: [
            {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
            },
            {
            role: "user",
            content: [
                { type: "input_text", text: "Describe what you see. If blank/black, say that explicitly." },
                { type: "input_image", image_url: imageDataUrl },
            ],
            },
        ],
        });

    // Extract text from response robustly
    let summary = ''
    if (resp) {
      // new Responses API shapes
      // Try common locations
      // @ts-ignore
      if (resp.output_text) summary = resp.output_text
      // @ts-ignore
      else if (resp.output?.[0]?.content) {
        // content can be array
        const content = resp.output[0].content
        const txt = Array.isArray(content)
          ? content.map((c: any) => c.text || c?.value || '').join(' ').trim()
          : (content.text || '')
        summary = txt
      } else if (Array.isArray(resp.output)) {
        summary = resp.output.map((o: any) => o?.text || '').join(' ').trim()
      }
    }

    summary = (summary || '').trim()
    if (!summary) summary = 'No meaningful change'
    if (summary !== 'No meaningful change') summary = `[Screen] ${summary}`

    // Upsert into Supabase
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    await supabase.from('meeting_screen_context').upsert(
      {
        meeting_id: meetingId,
        summary,
        updated_at: new Date().toISOString(),
        last_frame_ts: new Date(ts).toISOString(),
      },
      { onConflict: 'meeting_id' }
    )

    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('vision route error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
