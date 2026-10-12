import {
  BUG_CATEGORIES,
  BUG_PRIORITIES,
  REPORT_TYPES,
  buildReportBody,
  buildReportEmail,
  buildReportTitle,
  isReportCategory,
  isReportPriority,
  isReportType,
} from "@/lib/bugs";

describe("report vocab guards", () => {
  it("accepts every declared value and rejects junk", () => {
    for (const t of REPORT_TYPES) expect(isReportType(t)).toBe(true);
    for (const p of BUG_PRIORITIES) expect(isReportPriority(p)).toBe(true);
    for (const c of BUG_CATEGORIES) expect(isReportCategory(c)).toBe(true);
    expect(isReportType("nope")).toBe(false);
    expect(isReportPriority("urgent")).toBe(false);
    expect(isReportCategory("misc")).toBe(false);
  });
});

describe("buildReportTitle", () => {
  it("puts type, priority and category before the first line of the description", () => {
    expect(
      buildReportTitle("bug", "high", "judging", "Scores do not save\nSecond line ignored")
    ).toBe("Bug [High] Judging: Scores do not save");
  });

  it("truncates long headlines at 60 chars with an ellipsis", () => {
    const long = "x".repeat(80);
    const title = buildReportTitle("feature", "low", "other", long);
    expect(title).toBe(`Feature [Low] Other: ${"x".repeat(60)}…`);
  });
});

describe("buildReportBody", () => {
  const base = {
    type: "bug" as const,
    priority: "blocking" as const,
    category: "sign-in" as const,
    description: "Cannot log in with Google.",
    screenshotUrls: [] as string[],
    reporter: "Jane Doe",
    pageUrl: "https://www.mentormates.ai/login",
    userAgent: "jest",
  };

  it("includes description and metadata footer", () => {
    const body = buildReportBody(base);
    expect(body).toContain("Cannot log in with Google.");
    expect(body).toContain("Priority: Blocking");
    expect(body).toContain("Category: Sign-in");
    expect(body).toContain("Reported by: Jane Doe");
    expect(body).toContain("Page: https://www.mentormates.ai/login");
    expect(body).not.toContain("Screenshots:");
  });

  it("lists screenshot urls when present", () => {
    const body = buildReportBody({ ...base, screenshotUrls: ["https://a/1.png", "https://a/2.png"] });
    expect(body).toContain("Screenshots:");
    expect(body).toContain("https://a/1.png");
    expect(body).toContain("https://a/2.png");
  });
});

describe("buildReportEmail", () => {
  const input = {
    type: "bug" as const,
    priority: "high" as const,
    category: "events" as const,
    description: "Event page 500s <script>alert(1)</script>",
    reporter: "Jane <jane@example.com>",
    pageUrl: "https://www.mentormates.ai/events/x",
    screenshotUrls: ["https://a/1.png"],
  };

  it("builds a subject with priority, category and the first line", () => {
    const { subject } = buildReportEmail(input);
    expect(subject).toContain("[MentorMates]");
    expect(subject).toContain("Bug (High)");
    expect(subject).toContain("Events");
    expect(subject).toContain("Event page 500s");
  });

  it("escapes html in the html body and keeps text intact", () => {
    const { html, text } = buildReportEmail(input);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Jane &lt;jane@example.com&gt;");
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("https://a/1.png");
  });
});
