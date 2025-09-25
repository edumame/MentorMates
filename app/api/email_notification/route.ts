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

export async function POST(request: NextRequest) {
  try {
    const { to, from, subject, html, bcc, cc } = await request.json();

    const { data: user } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const emailData: EmailData = {
      from: from,
      to: to,
      subject: subject,
      html: html,
      bcc: bcc || [],
      cc: cc || [],
    };

    const { error: resendError } = await resend.emails.send(emailData);

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
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
