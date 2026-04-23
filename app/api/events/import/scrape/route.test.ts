/**
 * @jest-environment node
 *
 * Tests for the scrape proxy endpoint.
 * Uses node environment for proper Request/Response support.
 */

const mockFetch = jest.fn();
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.EVENT_SCRAPER_API_URL = "https://event-scraper.vercel.app";
});

afterAll(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
});

async function callRoute(body: unknown) {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/events/import/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req as Parameters<typeof POST>[0]);
}

describe("POST /api/events/import/scrape", () => {
  it("returns 500 when EVENT_SCRAPER_API_URL is not set", async () => {
    delete process.env.EVENT_SCRAPER_API_URL;
    const res = await callRoute({ url: "https://example.com" });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("EVENT_SCRAPER_API_URL");
  });

  it("returns 400 when url is missing", async () => {
    const res = await callRoute({});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("url");
  });

  it("returns 400 for invalid URL", async () => {
    const res = await callRoute({ url: "not-a-url" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid URL");
  });

  it("transforms scraped data into prefill format", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            event_name: "HackBattle 2026",
            event_date: "2026-04-01",
            location: "San Francisco",
            slug: "hackbattle-2026",
            event_description: "A hackathon",
            event_blurb: "Build cool stuff",
            cover_image_url: "https://img.example.com/cover.jpg",
            rules: [{ title: "General", items: ["Be nice"] }],
            faqs: [{ question: "When?", answer: "April" }],
            event_resources: [{ name: "Docs", link: "https://docs.example.com" }],
            tracks: [
              {
                name: "AI Track",
                description: "AI projects",
                scoring_criteria: [
                  { name: "Innovation", weight: 2, min: 1, max: 10 },
                ],
              },
            ],
          },
          runId: "run-123",
        }),
        { status: 200 }
      )
    );

    const res = await callRoute({ url: "https://hackbattle.devpost.com" });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.import.event_name).toBe("HackBattle 2026");
    expect(json.import.rules).toHaveLength(1);
    expect(json.import.faqs).toHaveLength(1);
    expect(json.import.tracks).toHaveLength(1);
    expect(json.import.tracks[0].criteria).toHaveLength(1);
    expect(json.runId).toBe("run-123");
  });

  it("calls event-scraper API with correct URL and profile", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, data: { event_name: "Test" } }),
        { status: 200 }
      )
    );

    await callRoute({
      url: "https://test.devpost.com",
      browserProfile: "stealth",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://event-scraper.vercel.app/api/scrape",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          url: "https://test.devpost.com",
          browserProfile: "stealth",
        }),
      })
    );
  });

  it("returns error when scraper fails", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, error: "TinyFish timeout" }),
        { status: 502 }
      )
    );

    const res = await callRoute({ url: "https://example.com" });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("TinyFish timeout");
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const res = await callRoute({ url: "https://example.com" });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("Network failure");
  });

  it("passes submission_fields through when present", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            event_name: "Test",
            submission_fields: [
              { id: "project_name", label: "Name", type: "text", required: true, placeholder: "" },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const res = await callRoute({ url: "https://example.com" });
    const json = await res.json();
    expect(json.import.submission_fields).toHaveLength(1);
    expect(json.import.submission_fields[0].id).toBe("project_name");
  });
});
