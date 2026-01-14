import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);

const BCC_MAX = 50;

const emailRequestSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
  bcc: z.array(z.string().min(1)).optional().default([]),
  cc: z.array(z.string().min(1)).optional().default([]),
});

type EmailRequest = z.infer<typeof emailRequestSchema>;

type ResendValidationError = {
  name: "validation_error";
  message: string;
  statusCode: 422;
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function isResendValidationError(error: unknown): error is ResendValidationError {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  return (
    e.name === "validation_error" &&
    typeof e.message === "string" &&
    e.statusCode === 422
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const body = await request.json();
    const parsed = emailRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const emailData: EmailRequest = parsed.data;

    // Resend enforces a 50-recipient limit for `bcc`.
    // If the UI selects more than 50 recipients, send multiple emails in batches.
    const bccChunks = chunkArray(emailData.bcc, BCC_MAX);

    for (const bccChunk of bccChunks) {
      const { error: resendError } = await resend.emails.send({
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        cc: emailData.cc,
        bcc: bccChunk,
      });

      if (resendError) {
        console.error("Resend error sending email_notification:", resendError);
        if (isResendValidationError(resendError)) {
          return NextResponse.json(resendError, { status: resendError.statusCode });
        }

        return NextResponse.json(
          { error: "Failed to send email" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { message: "Email sent successfully", batches: bccChunks.length },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
