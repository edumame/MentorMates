// Wires shipcue's handler to MentorMates: who is filing (the Supabase session),
// who may file agent tasks (admins), where screenshots go, and who hears about
// new reports. The dependencies come in as arguments so tests can swap them.
import { createShipcueHandler, type ReportStore } from "shipcue/server";
import type { Report } from "shipcue";
import { SHIPCUE_BASE_PATH, shipcueConfig } from "@/lib/shipcue/config";

export interface ShipcueUser {
  id: string;
  email: string | null;
}

export interface ShipcueDeps {
  store: ReportStore;
  /** The signed-in user from the request's session cookies, or null. */
  getUser: () => Promise<ShipcueUser | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  /** Bearer token for the agent API (SHIPCUE_TOKEN). Unset switches the agent API off. */
  agentToken?: string;
  saveScreenshot?: (file: File, key: string) => Promise<string>;
  onReport?: (report: Report) => Promise<void>;
}

/** What goes in the reporter column: the email, or the user id if there is none. */
export const reporterOf = (user: ShipcueUser | null): string | null =>
  user ? user.email ?? user.id : null;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export function createMentorMatesShipcueHandler(deps: ShipcueDeps): (req: Request) => Promise<Response> {
  // One session lookup per request, shared by the task check and getReporter.
  const users = new WeakMap<Request, Promise<ShipcueUser | null>>();
  const userFor = (req: Request) => {
    let user = users.get(req);
    if (!user) {
      user = deps.getUser().catch(() => null);
      users.set(req, user);
    }
    return user;
  };

  const shipcue = createShipcueHandler({
    store: deps.store,
    config: shipcueConfig,
    basePath: SHIPCUE_BASE_PATH,
    // Signed-out visitors can report bugs and request features; the button
    // only offers them those two tabs, and agent tasks are checked below.
    getReporter: async (req) => reporterOf(await userFor(req)),
    requireReporter: false,
    agentToken: deps.agentToken || undefined,
    saveScreenshot: deps.saveScreenshot,
    onReport: deps.onReport,
  });

  const filePath = `${SHIPCUE_BASE_PATH}/reports`;

  return async function handler(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname.replace(/\/$/, "");
    if (req.method === "POST" && path === filePath) {
      // Agent tasks are instructions to a coding agent: MentorMates admins only.
      let type: FormDataEntryValue | null = null;
      try {
        type = (await req.clone().formData()).get("type");
      } catch {
        // Not a form; shipcue answers that itself.
      }
      if (type === "task") {
        const user = await userFor(req);
        if (!user) return json({ error: "Sign in to send an agent task." }, 401);
        if (!(await deps.isAdmin(user.id).catch(() => false))) {
          return json({ error: "Agent tasks are for the MentorMates team." }, 403);
        }
      }
    }
    return shipcue(req);
  };
}
