import {
  DraftNotReadyError,
  applyDraftPatch,
  draftToCreatePayload,
  emptyDraft,
  eventLinkIn,
  eventLinkToImport,
  formatDraftWhen,
  isValidWallTime,
  missingFields,
  missingRequired,
  sanitizeDraft,
  sanitizeDraftPatch,
  slugify,
  utcIsoToWallTime,
  wallTimeToUtcIso,
  withNextQuestion,
  type EventDraft,
} from "./chat-draft";
import { eventCreateFieldsSchema } from "./create-event";

const LA = "America/Los_Angeles";

/** The BUILD NEXT event Chinat inserted by hand on prod, as a finished draft. */
function buildNextDraft(): EventDraft {
  return applyDraftPatch(emptyDraft(LA), {
    event_name: "BUILD NEXT@Stanford - Physical AI on Campus Hackathon",
    start: "2026-11-06T15:30",
    end: "2026-11-06T17:30",
    timezone: LA,
    location: "Stanford University, Stanford, CA (exact address shared after approval)",
    event_blurb:
      "Build a physical AI product in an afternoon: find co-founders, build with VLight, and pitch to Plug and Play, VCs and angels.",
    event_description: "## From Campus Ideas to Real-World Products\n\nGot a hardware idea?",
    schedule: [
      {
        day: "Friday, Nov 6",
        items: [
          { time: "3:30 PM", name: "Check-in and team matching" },
          { time: "4:00 PM", name: "Build session with VLight" },
        ],
      },
    ],
    hosts: "Plug and Play, VLight, Stanford CEO Club, One Culture Foundation, Human Futures Lab",
    require_participant_approval: true,
    participant_capacity: "unlimited",
    slug: "build-next-stanford",
  });
}

describe("slugify", () => {
  it("lowercases, hyphenates and trims", () => {
    expect(slugify("BUILD NEXT@Stanford - Physical AI!")).toBe("build-next-stanford-physical-ai");
    expect(slugify("  Café  Hack  ")).toBe("cafe-hack");
    expect(slugify("---")).toBe("");
  });

  it("cuts long names at a word boundary", () => {
    const slug = slugify("BUILD NEXT@Stanford - Physical AI on Campus Hackathon for Student Builders", 40);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("build-next-stanford-physical-ai-on");
  });
});

describe("time zones", () => {
  it("turns a wall time in a zone into the UTC instant", () => {
    expect(wallTimeToUtcIso("2026-11-06T15:30", LA)).toBe("2026-11-06T23:30:00.000Z");
    expect(wallTimeToUtcIso("2026-07-01T09:00", LA)).toBe("2026-07-01T16:00:00.000Z");
    expect(wallTimeToUtcIso("2026-11-06T15:30", "Asia/Hong_Kong")).toBe("2026-11-06T07:30:00.000Z");
    expect(wallTimeToUtcIso("2026-11-06T15:30", "UTC")).toBe("2026-11-06T15:30:00.000Z");
  });

  it("handles the days the clocks change", () => {
    // US DST ends 2026-11-01 at 2:00 local; 9:00 that day is PST (UTC-8).
    expect(wallTimeToUtcIso("2026-11-01T09:00", LA)).toBe("2026-11-01T17:00:00.000Z");
    // US DST starts 2026-03-08; 9:00 that day is PDT (UTC-7).
    expect(wallTimeToUtcIso("2026-03-08T09:00", LA)).toBe("2026-03-08T16:00:00.000Z");
  });

  it("round-trips through the wall time", () => {
    expect(utcIsoToWallTime("2026-11-06T23:30:00.000Z", LA)).toBe("2026-11-06T15:30");
    expect(utcIsoToWallTime("2026-11-07T01:30:00+00:00", LA)).toBe("2026-11-06T17:30");
    expect(utcIsoToWallTime("nope", LA)).toBeNull();
    expect(utcIsoToWallTime("2026-11-06T23:30:00Z", "Not/AZone")).toBeNull();
  });

  it("rejects impossible times and unknown zones", () => {
    expect(isValidWallTime("2026-02-30T10:00")).toBe(false);
    expect(isValidWallTime("2026-11-06T24:00")).toBe(false);
    expect(isValidWallTime("2026-11-06 15:30")).toBe(false);
    expect(isValidWallTime("2026-11-06T15:30")).toBe(true);
    expect(wallTimeToUtcIso("2026-11-06T15:30", "Mars/Olympus")).toBeNull();
  });

  it("formats the when line with the zone", () => {
    expect(formatDraftWhen({ start: "2026-11-06T15:30", end: "2026-11-06T17:30", timezone: LA })).toBe(
      "Fri, Nov 6, 3:30 PM – 5:30 PM PST"
    );
    expect(formatDraftWhen({ start: "2026-11-06T15:30", end: "2026-11-08T12:00", timezone: LA })).toBe(
      "Fri, Nov 6, 3:30 PM – Sun, Nov 8, 12:00 PM PST"
    );
    expect(formatDraftWhen({ start: "", end: "", timezone: LA })).toBe("");
  });
});

describe("sanitizeDraftPatch", () => {
  it("keeps good fields and drops bad ones without failing the rest", () => {
    const patch = sanitizeDraftPatch({
      event_name: "  Hack Night  ",
      start: "next friday",
      timezone: "Not/AZone",
      participant_capacity: -5,
      require_participant_approval: "yes",
      location: "SF",
      unknown_field: "x",
    });
    expect(patch).toEqual({ event_name: "Hack Night", location: "SF" });
  });

  it("clamps text to the create schema's limits", () => {
    const patch = sanitizeDraftPatch({ event_blurb: "x".repeat(900), event_description: "y".repeat(9000) });
    expect(patch.event_blurb).toHaveLength(500);
    expect(patch.event_description).toHaveLength(5000);
  });

  it("slugifies a slug the model or organiser writes loosely", () => {
    expect(sanitizeDraftPatch({ slug: "Build Next!" }).slug).toBe("build-next");
    expect(sanitizeDraftPatch({ slug: "!!!" }).slug).toBeUndefined();
  });

  it("cleans the schedule", () => {
    const patch = sanitizeDraftPatch({
      schedule: [
        { day: "Fri", items: [{ time: "3pm", name: "Doors" }, { time: "4pm", name: "" }, "junk"] },
        { day: "Sat", items: [] },
        null,
      ],
    });
    expect(patch.schedule).toEqual([{ day: "Fri", items: [{ time: "3pm", name: "Doors" }] }]);
  });

  it("accepts unlimited capacity and null approval", () => {
    expect(sanitizeDraftPatch({ participant_capacity: "unlimited" }).participant_capacity).toBe("unlimited");
    expect(sanitizeDraftPatch({ participant_capacity: 120 }).participant_capacity).toBe(120);
    expect(sanitizeDraftPatch({ participant_capacity: 1.5 })).toEqual({});
  });

  it("ignores non-objects", () => {
    expect(sanitizeDraftPatch(null)).toEqual({});
    expect(sanitizeDraftPatch(["a"])).toEqual({});
    expect(sanitizeDraftPatch("x")).toEqual({});
  });
});

describe("applyDraftPatch", () => {
  it("derives the slug from the name until one is set", () => {
    let d = applyDraftPatch(emptyDraft(LA), { event_name: "Spring Hack 2027" });
    expect(d.slug).toBe("spring-hack-2027");
    expect(d.slug_custom).toBe(false);
    d = applyDraftPatch(d, { slug: "spring" });
    expect(d.slug).toBe("spring");
    expect(d.slug_custom).toBe(true);
    d = applyDraftPatch(d, { event_name: "Spring Hackathon 2027" });
    expect(d.slug).toBe("spring");
  });

  it("drops an end that is not after the start", () => {
    const d = applyDraftPatch(emptyDraft(LA), { start: "2026-11-06T16:00", end: "2026-11-06T15:00" });
    expect(d.end).toBe("");
  });

  it("moves a start the way the chat does for 'make it 4pm'", () => {
    const d = applyDraftPatch(buildNextDraft(), { start: "2026-11-06T16:00", end: "2026-11-06T18:00" });
    expect(d.start).toBe("2026-11-06T16:00");
    expect(d.end).toBe("2026-11-06T18:00");
    expect(d.slug).toBe("build-next-stanford");
  });
});

describe("sanitizeDraft", () => {
  it("rebuilds a whole draft from untrusted input", () => {
    const d = sanitizeDraft({ event_name: "X Hack", slug: "x", slug_custom: true, start: "bad", timezone: "Nope/Zone" }, LA);
    expect(d.event_name).toBe("X Hack");
    expect(d.start).toBe("");
    expect(d.timezone).toBe(LA);
    expect(d.slug_custom).toBe(true);
    expect(d.require_participant_approval).toBeNull();
  });

  it("does not trust slug_custom without a slug", () => {
    expect(sanitizeDraft({ slug_custom: true }, LA).slug_custom).toBe(false);
    expect(sanitizeDraft(null, "Bad/Zone").timezone).toBe("UTC");
  });
});

describe("what is missing", () => {
  it("asks for required fields first, then the asked-once ones", () => {
    expect(missingFields(emptyDraft(LA))).toEqual([
      "event_name",
      "start",
      "location",
      "hosts",
      "require_participant_approval",
      "participant_capacity",
    ]);
    expect(missingFields(buildNextDraft())).toEqual([]);
    expect(missingRequired(applyDraftPatch(emptyDraft(LA), { event_name: "Hi" }))).toContain("event_name");
  });

  it("adds one question when the reply asks none", () => {
    const d = applyDraftPatch(emptyDraft(LA), { event_name: "Spring Hack" });
    expect(withNextQuestion("Drafted it.", d)).toBe("Drafted it.\n\nWhen is it? A date, start time and end time is perfect.");
    expect(withNextQuestion("Where is it?", d)).toBe("Where is it?");
    expect(withNextQuestion("All set.", buildNextDraft())).toBe("All set.");
    expect(withNextQuestion("", d)).toBe("When is it? A date, start time and end time is perfect.");
  });
});

describe("eventLinkToImport", () => {
  const started = { ...emptyDraft("UTC"), event_name: "Demo Day" };

  it("imports a link with words around it before a draft has started", () => {
    expect(eventLinkToImport("here it is: https://lu.ma/abc123", emptyDraft("UTC"))).toBe("https://lu.ma/abc123");
  });

  it("imports a bare link on a started draft", () => {
    expect(eventLinkToImport(" https://lu.ma/abc123 ", started)).toBe("https://lu.ma/abc123");
  });

  it("treats a sentence with a link on a started draft as an edit", () => {
    expect(eventLinkToImport("add https://example.com/apply to the description", started)).toBeNull();
  });
});

describe("eventLinkIn", () => {
  it("finds a link in a short message", () => {
    expect(eventLinkIn("https://luma.com/abc123")).toBe("https://luma.com/abc123");
    expect(eventLinkIn("here it is: https://lu.ma/abc123.")).toBe("https://lu.ma/abc123");
    expect(eventLinkIn("no link here")).toBeNull();
    expect(eventLinkIn("javascript:alert(1)")).toBeNull();
  });

  it("treats long pasted text as text even if it has links", () => {
    expect(eventLinkIn(`${"Event details. ".repeat(40)} https://luma.com/abc123`)).toBeNull();
  });
});

describe("draftToCreatePayload", () => {
  it("matches the hand-made BUILD NEXT row and passes the shared create schema", () => {
    const { event } = draftToCreatePayload(buildNextDraft());
    expect(event).toEqual({
      event_name: "BUILD NEXT@Stanford - Physical AI on Campus Hackathon",
      event_date: "2026-11-06T23:30:00.000Z",
      location: "Stanford University, Stanford, CA (exact address shared after approval)",
      visibility: "draft",
      event_type: ["hackathon"],
      require_participant_approval: true,
      slug: "build-next-stanford",
      event_blurb:
        "Build a physical AI product in an afternoon: find co-founders, build with VLight, and pitch to Plug and Play, VCs and angels.",
      event_description: "## From Campus Ideas to Real-World Products\n\nGot a hardware idea?",
      organizer_affiliation: "Plug and Play, VLight, Stanford CEO Club, One Culture Foundation, Human Futures Lab",
      submission_time_start: "2026-11-06T23:30:00.000Z",
      submission_time_cutoff: "2026-11-07T01:30:00.000Z",
      event_schedule: [
        {
          time: "Friday, Nov 6",
          events: [
            { time: "3:30 PM", name: "Check-in and team matching" },
            { time: "4:00 PM", name: "Build session with VLight" },
          ],
        },
      ],
    });
    expect(eventCreateFieldsSchema.safeParse(event).success).toBe(true);
  });

  it("leaves out what is unknown", () => {
    const d = applyDraftPatch(emptyDraft(LA), {
      event_name: "Quick Hack",
      start: "2026-12-01T10:00",
      location: "Online",
      participant_capacity: 50,
    });
    const { event } = draftToCreatePayload(d);
    expect(event.participant_capacity).toBe(50);
    expect(event.require_participant_approval).toBe(false);
    expect(event.submission_time_start).toBeUndefined();
    expect(event.event_schedule).toBeUndefined();
    expect(event.organizer_affiliation).toBeUndefined();
    expect(event.slug).toBe("quick-hack");
  });

  it("refuses a draft without the required fields", () => {
    const d = applyDraftPatch(emptyDraft(LA), { event_name: "Quick Hack" });
    expect(() => draftToCreatePayload(d)).toThrow(DraftNotReadyError);
    try {
      draftToCreatePayload(d);
    } catch (error) {
      expect((error as DraftNotReadyError).missing).toEqual(["start", "location"]);
      expect((error as Error).message).toBe("Still needs: date and time, location");
    }
  });
});
