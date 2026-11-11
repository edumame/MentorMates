import { scrapedEventFields } from "./scrapedEventFields";

describe("scrapedEventFields", () => {
  it("maps scraper output to the saved EventDetails shape", () => {
    const fields = scrapedEventFields({
      event_name: "New name",
      event_date: "2026-06-15",
      location: "Online",
      event_blurb: "Blurb",
      event_description: "Description",
      event_schedule: [
        {
          date: "2026-06-15",
          events: [{ name: "Kickoff", time: "09:00", description: null }],
        },
      ],
      rules: [{ title: "Eligibility", items: ["Be a student"] }],
      event_resources: [{ name: "Docs", link: "https://docs.example.com" }],
      faqs: [{ question: "Who?", answer: "You" }],
    });

    expect(fields).toEqual({
      event_name: "New name",
      event_date: "2026-06-15",
      location: "Online",
      event_blurb: "Blurb",
      event_description: "Description",
      // The editor and public pages read a day's title from `time`, not `date`.
      event_schedule: [
        { time: "2026-06-15", events: [{ name: "Kickoff", time: "09:00" }] },
      ],
      rules: [{ title: "Eligibility", items: ["Be a student"] }],
      event_resources: [{ name: "Docs", link: "https://docs.example.com" }],
      faq: [{ question: "Who?", answer: "You" }],
    });
  });

  it("omits null, empty and missing values so existing content is kept", () => {
    expect(
      scrapedEventFields({
        event_name: "",
        location: null,
        event_blurb: null,
        event_schedule: [],
        rules: [],
        event_resources: null,
        faqs: [],
      }),
    ).toEqual({});
  });

  it("never returns a slug, tracks or prizes", () => {
    const fields = scrapedEventFields({
      slug: "scraped",
      event_name: "Name",
      tracks: [{ name: "Track" }],
      prizes: [{ name: "$1" }],
    });
    expect(fields).toEqual({ event_name: "Name" });
  });

  it("ignores malformed tracks instead of failing the import", () => {
    expect(
      scrapedEventFields({ event_name: "Name", tracks: [null] }),
    ).toEqual({ event_name: "Name" });
  });

  it("stores submission times as absolute instants and drops invalid ones", () => {
    const naive = "2026-06-15T09:00:00";
    expect(
      scrapedEventFields({
        submission_time_start: naive,
        submission_time_cutoff: "when it is done",
      }),
    ).toEqual({ submission_time_start: new Date(naive).toISOString() });
  });
});
