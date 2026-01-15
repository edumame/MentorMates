import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailData {
  from: string;
  to: string;
  subject: string;
  html: string;
  bcc?: string[];
  cc?: string[];
}


// assuming resend allows 50 recipients per email, we need to send in batches of 49 to include the "to" recipient
const MAX_RECIPIENTS_PER_BATCH = 49;

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const { to, from, subject, html, bcc, cc } = await request.json();

    const { data: user } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bccArray: string[] = Array.isArray(bcc) ? bcc : [];
    const ccArray: string[] = Array.isArray(cc) ? cc : [];

    // Check if we need to batch
    const needsBatching = bccArray.length > MAX_RECIPIENTS_PER_BATCH || ccArray.length > MAX_RECIPIENTS_PER_BATCH;

    if (!needsBatching) {
      // Single email send
      const emailData: EmailData = {
        from: from,
        to: to,
        subject: subject,
        html: html,
        bcc: bccArray,
        cc: ccArray,
      };

      const { error: resendError } = await resend.emails.send(emailData);
      console.error(resendError);

      if (resendError) {
        return NextResponse.json(
          { error: "Failed to send email" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: "Email sent successfully" },
        { status: 200 }
      );
    }

    // Batch processing
    const bccBatches = chunkArray<string>(bccArray, MAX_RECIPIENTS_PER_BATCH);
    const ccBatches = chunkArray<string>(ccArray, MAX_RECIPIENTS_PER_BATCH);
    
    // Determine the maximum number of batches needed
    const maxBatches = Math.max(bccBatches.length, ccBatches.length);
    
    const sendPromises: Promise<unknown>[] = [];

    for (let i = 0; i < maxBatches; i++) {
      const batchBcc: string[] = bccBatches[i] || [];
      const batchCc: string[] = ccBatches[i] || [];

      const emailData: EmailData = {
        from: from,
        to: to,
        subject: subject,
        html: html,
        bcc: batchBcc,
        cc: batchCc,
      };

      sendPromises.push(resend.emails.send(emailData));
    }

    const results = await Promise.allSettled(sendPromises);
    
    // Check for any failures
    const failures = results.filter((result) => result.status === "rejected" || 
      (result.status === "fulfilled" && result.value && typeof result.value === "object" && "error" in result.value && result.value.error)
    );

    if (failures.length > 0) {
      console.error("Some email batches failed:", failures);
      return NextResponse.json(
        { error: "Some emails failed to send", failedBatches: failures.length },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: `Email sent successfully in ${maxBatches} batch(es)` },
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
