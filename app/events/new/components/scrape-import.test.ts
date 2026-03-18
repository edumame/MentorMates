import { extractScrapedImportPayload } from "./scrape-import";

describe("extractScrapedImportPayload", () => {
  it("returns the new proxy import payload", () => {
    expect(
      extractScrapedImportPayload({
        import: { event_name: "Hackathon" },
        runId: "run-1",
      })
    ).toEqual({ event_name: "Hackathon" });
  });

  it("supports the legacy success/data response shape", () => {
    expect(
      extractScrapedImportPayload({
        success: true,
        data: { event_name: "Legacy Hackathon" },
      })
    ).toEqual({ event_name: "Legacy Hackathon" });
  });

  it("throws the server error message when scraping fails", () => {
    expect(() =>
      extractScrapedImportPayload({
        error: "TinyFish timeout",
      })
    ).toThrow("TinyFish timeout");
  });
});
