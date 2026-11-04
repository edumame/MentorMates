/** @jest-environment node */

import {
  LUMA_API_URL,
  LumaImportError,
  fetchLumaEvent,
  lumaEventSlug,
  prosemirrorToMarkdown,
  summarizeLumaEvent,
} from "./luma-import";

describe("lumaEventSlug", () => {
  it("reads event links on Luma's hosts", () => {
    expect(lumaEventSlug("https://luma.com/build-next")).toBe("build-next");
    expect(lumaEventSlug("https://lu.ma/abc123?tk=x")).toBe("abc123");
    expect(lumaEventSlug("https://www.luma.com/abc123/")).toBe("abc123");
  });

  it("rejects other hosts, app routes and nested paths", () => {
    expect(lumaEventSlug("https://evil.com/abc123")).toBeNull();
    expect(lumaEventSlug("https://luma.com.evil.com/abc123")).toBeNull();
    expect(lumaEventSlug("https://luma.com/discover")).toBeNull();
    expect(lumaEventSlug("https://luma.com/user/abc")).toBeNull();
    expect(lumaEventSlug("https://luma.com/")).toBeNull();
    expect(lumaEventSlug("not a url")).toBeNull();
    expect(lumaEventSlug("ftp://luma.com/abc")).toBeNull();
  });
});

describe("prosemirrorToMarkdown", () => {
  it("keeps headings, paragraphs, marks, links and lists", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "From Campus Ideas" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Got a " },
            { type: "text", text: "hardware", marks: [{ type: "bold" }] },
            { type: "text", text: " idea?" },
            { type: "hard_break" },
            { type: "text", text: "Join", marks: [{ type: "link", attrs: { href: "https://x.test" } }] },
          ],
        },
        {
          type: "bullet_list",
          content: [
            { type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Find a co-founder" }] }] },
            { type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Meet investors" }] }] },
          ],
        },
      ],
    };
    expect(prosemirrorToMarkdown(doc)).toBe(
      "## From Campus Ideas\n\nGot a **hardware** idea?\n[Join](https://x.test)\n\n- Find a co-founder\n- Meet investors"
    );
  });

  it("is empty for nothing", () => {
    expect(prosemirrorToMarkdown(null)).toBe("");
    expect(prosemirrorToMarkdown("x")).toBe("");
  });
});

const lumaPayload = {
  kind: "event",
  data: {
    event: {
      name: "BUILD NEXT@Stanford",
      start_at: "2026-11-06T23:30:00.000Z",
      end_at: "2026-11-07T01:30:00.000Z",
      timezone: "America/Los_Angeles",
      geo_address_info: { full_address: "Stanford University, Stanford, CA" },
      cover_url: "https://images.lumacdn.com/x.png",
    },
    hosts: [{ name: "Plug and Play" }, { name: "VLight" }, { name: "" }],
    calendar: { name: "Stanford CEO Club" },
    ticket_info: { require_approval: true, is_free: true },
    ticket_types: [{ max_capacity: 60 }, { max_capacity: null }],
    description_mirror: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Build it." }] }] },
  },
};

describe("summarizeLumaEvent", () => {
  it("keeps what the draft needs, with local times", () => {
    expect(summarizeLumaEvent(lumaPayload, "https://luma.com/x")).toEqual({
      source: "luma",
      url: "https://luma.com/x",
      name: "BUILD NEXT@Stanford",
      start_at: "2026-11-06T23:30:00.000Z",
      end_at: "2026-11-07T01:30:00.000Z",
      timezone: "America/Los_Angeles",
      start_local: "2026-11-06T15:30",
      end_local: "2026-11-06T17:30",
      location: "Stanford University, Stanford, CA",
      description_markdown: "Build it.",
      hosts: ["Plug and Play", "VLight"],
      calendar: "Stanford CEO Club",
      require_approval: true,
      capacity: 60,
      is_free: true,
      cover_url: "https://images.lumacdn.com/x.png",
    });
  });

  it("is null for anything that is not an event", () => {
    expect(summarizeLumaEvent({}, "u")).toBeNull();
    expect(summarizeLumaEvent({ data: { event: {} } }, "u")).toBeNull();
    expect(summarizeLumaEvent(null, "u")).toBeNull();
  });
});

describe("fetchLumaEvent", () => {
  const ok = (body: unknown, init: ResponseInit = {}) =>
    ({
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    }) as unknown as Response;

  it("only ever calls Luma's API host with the slug", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok(lumaPayload));
    const summary = await fetchLumaEvent("abc123", "https://luma.com/abc123", fetchImpl);
    expect(summary.name).toBe("BUILD NEXT@Stanford");
    expect(fetchImpl).toHaveBeenCalledWith(`${LUMA_API_URL}?url=abc123`, expect.objectContaining({ redirect: "error" }));
  });

  it("explains failures in words fit to show", async () => {
    await expect(fetchLumaEvent("../x", "u", jest.fn())).rejects.toThrow(LumaImportError);
    await expect(fetchLumaEvent("abc", "u", jest.fn().mockResolvedValue(ok({}, { status: 404 })))).rejects.toThrow(
      "Luma couldn't find that event."
    );
    await expect(fetchLumaEvent("abc", "u", jest.fn().mockResolvedValue(ok({}, { status: 500 })))).rejects.toThrow(
      "Luma couldn't share that event."
    );
    await expect(fetchLumaEvent("abc", "u", jest.fn().mockRejectedValue(new Error("timeout")))).rejects.toThrow(
      "Luma didn't answer in time."
    );
    await expect(fetchLumaEvent("abc", "u", jest.fn().mockResolvedValue(ok("<html>")))).rejects.toThrow(
      "Luma sent something unexpected."
    );
    await expect(fetchLumaEvent("abc", "u", jest.fn().mockResolvedValue(ok({ data: {} })))).rejects.toThrow(
      "That Luma link isn't a public event."
    );
    await expect(
      fetchLumaEvent("abc", "u", jest.fn().mockResolvedValue(ok({}, { headers: { "content-length": "99999999" } })))
    ).rejects.toThrow("too large");
  });
});
