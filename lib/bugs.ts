// Bug-report vocab shared by the API route and the UI.
// Mirrors the Stanford Founders hub report system, adapted to MentorMates.

export const BUG_PRIORITIES = ["low", "medium", "high", "blocking"] as const;
export type BugPriority = (typeof BUG_PRIORITIES)[number];

export const BUG_CATEGORIES = [
  "events",
  "projects",
  "judging",
  "sign-in",
  "emails",
  "other",
] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

export const REPORT_TYPES = ["bug", "feature"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const PRIORITY_LABEL: Record<BugPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  blocking: "Blocking",
};

export const CATEGORY_LABEL: Record<BugCategory, string> = {
  events: "Events",
  projects: "Projects",
  judging: "Judging",
  "sign-in": "Sign-in",
  emails: "Emails",
  other: "Other",
};

export const TYPE_LABEL: Record<ReportType, string> = {
  bug: "Bug",
  feature: "Feature request",
};

export function isReportType(v: string): v is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(v);
}
export function isReportPriority(v: string): v is BugPriority {
  return (BUG_PRIORITIES as readonly string[]).includes(v);
}
export function isReportCategory(v: string): v is BugCategory {
  return (BUG_CATEGORIES as readonly string[]).includes(v);
}

const TITLE_PREFIX: Record<ReportType, string> = { bug: "Bug", feature: "Feature" };
const HEADLINE_MAX = 60;

/** "Bug [High] Judging: first line of the description" */
export function buildReportTitle(
  type: ReportType,
  priority: BugPriority,
  category: BugCategory,
  description: string
): string {
  const firstLine = description.trim().split("\n")[0].trim();
  const headline =
    firstLine.slice(0, HEADLINE_MAX) + (firstLine.length > HEADLINE_MAX ? "…" : "");
  return `${TITLE_PREFIX[type]} [${PRIORITY_LABEL[priority]}] ${CATEGORY_LABEL[category]}: ${headline}`;
}

export interface ReportBodyInput {
  type: ReportType;
  priority: BugPriority;
  category: BugCategory;
  description: string;
  screenshotUrls: readonly string[];
  reporter: string;
  pageUrl: string;
  userAgent: string;
}

export function buildReportBody(input: ReportBodyInput): string {
  return [
    input.description.trim(),
    "",
    ...(input.screenshotUrls.length ? ["Screenshots:", ...input.screenshotUrls, ""] : []),
    "---",
    `Type: ${TYPE_LABEL[input.type]}`,
    `Priority: ${PRIORITY_LABEL[input.priority]}`,
    `Category: ${CATEGORY_LABEL[input.category]}`,
    `Reported by: ${input.reporter}`,
    `Page: ${input.pageUrl}`,
    `Browser: ${input.userAgent}`,
  ].join("\n");
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ReportEmailInput {
  type: ReportType;
  priority: BugPriority;
  category: BugCategory;
  description: string;
  reporter: string;
  pageUrl: string;
  screenshotUrls: string[];
}

/** Subject, text and html for the "new report" email sent to the team. */
export function buildReportEmail(input: ReportEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const firstLine = input.description.trim().split("\n")[0].slice(0, 90);
  const kind = TITLE_PREFIX[input.type];
  const subject = `[MentorMates] ${kind} (${PRIORITY_LABEL[input.priority]}) · ${CATEGORY_LABEL[input.category]}: ${firstLine}`;
  const text = [
    `${input.reporter} filed a ${TYPE_LABEL[input.type].toLowerCase()} (${PRIORITY_LABEL[input.priority]} · ${CATEGORY_LABEL[input.category]}).`,
    "",
    input.description.trim(),
    "",
    ...(input.screenshotUrls.length ? ["Screenshots:", ...input.screenshotUrls, ""] : []),
    `Reported by: ${input.reporter}`,
    `Page: ${input.pageUrl}`,
  ].join("\n");
  const html = [
    `<p><strong>${escapeHtml(input.reporter)}</strong> filed a ${escapeHtml(
      TYPE_LABEL[input.type].toLowerCase()
    )} (${PRIORITY_LABEL[input.priority]} · ${escapeHtml(CATEGORY_LABEL[input.category])}).</p>`,
    `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #d4d4d8;color:#3f3f46;white-space:pre-wrap;">${escapeHtml(
      input.description.trim()
    )}</blockquote>`,
    ...(input.screenshotUrls.length
      ? [
          `<p>Screenshots:<br/>${input.screenshotUrls
            .map((u) => `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`)
            .join("<br/>")}</p>`,
        ]
      : []),
    `<p style="color:#71717a;font-size:12px;">Page: <a href="${escapeHtml(
      input.pageUrl
    )}">${escapeHtml(input.pageUrl)}</a></p>`,
  ].join("\n");
  return { subject, text, html };
}
