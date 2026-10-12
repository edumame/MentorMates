// shipcue's report queue (github.com/cyu60/shipcue). The report button posts
// here; coding agents work the queue over MCP (npx shipcue-mcp) with the
// SHIPCUE_TOKEN bearer token. See lib/shipcue/handler.ts for the wiring.
import { createMentorMatesShipcueHandler } from "@/lib/shipcue/handler";
import { shipcueDeps } from "@/lib/shipcue/server";

export const dynamic = "force-dynamic";

let handler: ((req: Request) => Promise<Response>) | null = null;
// Built on first request so the build does not need Supabase or SHIPCUE_TOKEN.
const getHandler = () => (handler ??= createMentorMatesShipcueHandler(shipcueDeps()));

export function GET(req: Request) {
  return getHandler()(req);
}

export function POST(req: Request) {
  return getHandler()(req);
}
