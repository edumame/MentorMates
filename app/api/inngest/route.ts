import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { meetingsProcessing } from "@/lib/inngest/functions";

export const runtime = "nodejs";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    meetingsProcessing,
  ],
});
