import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { meetingsProcessing, sendInvitationEmails } from "@/lib/inngest/functions";

export const runtime = "nodejs";

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    meetingsProcessing,
    sendInvitationEmails,
  ],
});
