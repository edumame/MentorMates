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

    // Try to create a concise multimodal request. Be explicit about types to avoid `any`.
    type ImageDetailQuality = "auto" | "low" | "high";
    type ResponseContentItem =
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: ImageDetailQuality };
    type ResponseInput = { role: "system" | "user"; content: ResponseContentItem[] };

    const input: ResponseInput[] = [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Describe what you see. If blank/black, say that explicitly." },
          { type: "input_image", image_url: imageDataUrl, detail: "auto" },
        ],
      },
    ];

    const resp = await openai.responses.create({
      model: process.env.OPENAI_RESPONSES_MODEL || "gpt-4o-mini",
      input,
    });

    // Extract text from response robustly
    function extractTextFromContent(content: unknown): string {
      if (!content) return ''
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content
          .map((item) => {
            if (!item) return ''
            if (typeof item === 'string') return item
            const obj = item as { text?: string; value?: string }
            return obj.text || obj.value || ''
          })
          .join(' ')
          .trim()
      }
      if (typeof content === 'object') {
        const obj = content as { text?: string; value?: string }
        return obj.text || obj.value || ''
      }
      return ''
    }

    let summary = ''
    if (resp) {
      // new Responses API shapes
      // Try common locations
      const respRec = resp as unknown as Record<string, unknown>
      if (typeof respRec.output_text === 'string') {
        summary = String(respRec.output_text)
      } else if (Array.isArray(respRec.output)) {
        const out = respRec.output as unknown[]
        const first = out[0] as Record<string, unknown> | undefined
        if (first && typeof first.content !== 'undefined') {
          const content = first.content
          const txt = extractTextFromContent(content)
          summary = txt
        } else {
          summary = out
            .map((o: unknown) => {
              if (!o) return ''
              if (typeof o === 'string') return o
              const oo = o as { text?: string; content?: unknown }
              return oo.text || extractTextFromContent(oo.content)
            })
            .join(' ')
            .trim()
        }
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
