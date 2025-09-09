import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { getGuideFreeAccessEmailTemplate } from '@/lib/email_templates/guide-free-access'

const schema = z.object({
  email: z.string().email(),
  linkedinUrl: z.string().url().refine((url: string) => url.includes('linkedin.com'), {
    message: 'Must be a valid LinkedIn URL',
  }),
})

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { email, linkedinUrl } = schema.parse(json)

    const { subject, html } = getGuideFreeAccessEmailTemplate({ email, linkedinUrl })

    const to = process.env.EMAIL_USER
    if (!to) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
      replyTo: email,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const anyErr = err as { issues?: unknown }
    if (anyErr?.issues) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    console.error('Free access request error', err)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }
}

