// shipcue (github.com/cyu60/shipcue, v0.3.1) settings shared by the report button and
// the /api/shipcue handler. The button and the server must agree on the areas,
// or the server rejects the report's area.
import { resolveConfig, type Area, type ReportType } from "shipcue";

/** The main parts of MentorMates, from the app's routes. shipcue adds "Other". */
export const SHIPCUE_AREAS: Area[] = [
  { value: "events", label: "Events" },
  { value: "projects", label: "Projects & submissions" },
  { value: "judging", label: "Judging & voting" },
  { value: "dashboard", label: "Dashboards" },
  { value: "profile", label: "Profile & onboarding" },
  { value: "tickets", label: "Tickets & check-in" },
  { value: "payments", label: "Payments" },
  { value: "chat", label: "Chat & calls" },
  { value: "learn", label: "Learn & resources" },
  { value: "admin", label: "Admin" },
  { value: "sign-in", label: "Sign-in" },
  { value: "emails", label: "Emails" },
];

export const shipcueConfig = resolveConfig({ areas: SHIPCUE_AREAS });

/** Where the handler is mounted: app/api/shipcue/[...path]/route.ts. */
export const SHIPCUE_BASE_PATH = "/api/shipcue";

/** Signed-out visitors and non-admins file bugs and feature requests only. */
export const PUBLIC_TYPES: ReportType[] = ["bug", "feature"];
/** Agent tasks are direct instructions to a coding agent, so only admins file them. */
export const ADMIN_TYPES: ReportType[] = ["bug", "feature", "task"];

/** Screenshots and videos go to the same public bucket the old bug reports used. */
export const SHIPCUE_BUCKET = "project-materials";
export const SHIPCUE_PREFIX = "shipcue";

/** A video can be attached by whoever filed the report, once, within this window (as in shipcue). */
export const VIDEO_WINDOW_MS = 30 * 60 * 1000;
