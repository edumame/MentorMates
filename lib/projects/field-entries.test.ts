import {
  buildEntryContent,
  entryContentInputSchema,
  entryRowToPayload,
  MAX_ENTRY_ATTACHMENTS,
} from "./field-entries";

const baseRow = {
  id: "entry-1",
  project_id: "project-1",
  event_submission_field_id: "field-1",
  submitter_user_id: "user-1",
  created_at: "2026-07-31T00:00:00Z",
  updated_at: "2026-07-31T00:00:00Z",
};

describe("entryContentInputSchema", () => {
  it("accepts text-only input", () => {
    expect(
      entryContentInputSchema.safeParse({ content: "Progress update" }).success,
    ).toBe(true);
  });

  it("accepts attachment-only input", () => {
    expect(
      entryContentInputSchema.safeParse({
        attachments: [{ name: "demo.pdf", url: "https://cdn.example.com/demo.pdf" }],
      }).success,
    ).toBe(true);
  });

  it("rejects input with neither text nor attachments", () => {
    expect(entryContentInputSchema.safeParse({}).success).toBe(false);
    expect(
      entryContentInputSchema.safeParse({ content: "   ", attachments: [] })
        .success,
    ).toBe(false);
  });

  it("rejects attachments with invalid URLs", () => {
    expect(
      entryContentInputSchema.safeParse({
        attachments: [{ name: "demo.pdf", url: "not-a-url" }],
      }).success,
    ).toBe(false);
  });

  it("rejects more than the attachment limit", () => {
    const attachments = Array.from(
      { length: MAX_ENTRY_ATTACHMENTS + 1 },
      (_, index) => ({
        name: `file-${index}.png`,
        url: `https://cdn.example.com/file-${index}.png`,
      }),
    );
    expect(entryContentInputSchema.safeParse({ attachments }).success).toBe(
      false,
    );
  });
});

describe("buildEntryContent", () => {
  it("keeps text-only entries as plain strings (v1 format)", () => {
    expect(buildEntryContent({ content: "Just text" })).toBe("Just text");
  });

  it("wraps entries with attachments in a structured object", () => {
    const attachments = [
      { name: "demo.pdf", url: "https://cdn.example.com/demo.pdf" },
    ];
    expect(buildEntryContent({ content: "See attached", attachments })).toEqual({
      text: "See attached",
      attachments,
    });
  });

  it("defaults missing text to an empty string", () => {
    const attachments = [
      { name: "demo.pdf", url: "https://cdn.example.com/demo.pdf" },
    ];
    expect(buildEntryContent({ attachments })).toEqual({
      text: "",
      attachments,
    });
  });
});

describe("entryRowToPayload", () => {
  it("parses legacy plain-string content", () => {
    const payload = entryRowToPayload({ ...baseRow, content: "Legacy entry" });
    expect(payload.content).toBe("Legacy entry");
    expect(payload.attachments).toEqual([]);
  });

  it("parses structured content with attachments", () => {
    const payload = entryRowToPayload({
      ...baseRow,
      content: {
        text: "See attached",
        attachments: [
          { name: "demo.pdf", url: "https://cdn.example.com/demo.pdf" },
        ],
      },
    });
    expect(payload.content).toBe("See attached");
    expect(payload.attachments).toEqual([
      { name: "demo.pdf", url: "https://cdn.example.com/demo.pdf" },
    ]);
  });

  it("drops malformed attachment items", () => {
    const payload = entryRowToPayload({
      ...baseRow,
      content: {
        text: "",
        attachments: [
          { name: "ok.png", url: "https://cdn.example.com/ok.png" },
          { name: 42 },
          "junk",
        ],
      },
    });
    expect(payload.attachments).toEqual([
      { name: "ok.png", url: "https://cdn.example.com/ok.png" },
    ]);
  });

  it("resolves submitter display names", () => {
    const payload = entryRowToPayload(
      { ...baseRow, content: "hi" },
      new Map([["user-1", "Jamie"]]),
    );
    expect(payload.submitter_display_name).toBe("Jamie");
  });
});
