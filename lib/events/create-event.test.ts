import { buildEventInsert, eventCreateFieldsSchema, isSlugTakenError } from "./create-event";

const base = {
  event_name: "Spring Hack",
  event_date: "2026-11-06T23:30:00.000Z",
  location: "Stanford",
};

describe("eventCreateFieldsSchema", () => {
  it("requires a name, a parseable date and a location", () => {
    expect(eventCreateFieldsSchema.safeParse(base).success).toBe(true);
    expect(eventCreateFieldsSchema.safeParse({ ...base, event_name: "Hi" }).success).toBe(false);
    expect(eventCreateFieldsSchema.safeParse({ ...base, event_date: "soon" }).success).toBe(false);
    expect(eventCreateFieldsSchema.safeParse({ ...base, location: "  " }).success).toBe(false);
  });

  it("enforces URL-safe slugs and text limits", () => {
    expect(eventCreateFieldsSchema.safeParse({ ...base, slug: "build-next" }).success).toBe(true);
    expect(eventCreateFieldsSchema.safeParse({ ...base, slug: "../admin" }).success).toBe(false);
    expect(eventCreateFieldsSchema.safeParse({ ...base, slug: "has space" }).success).toBe(false);
    expect(eventCreateFieldsSchema.safeParse({ ...base, event_blurb: "x".repeat(501) }).success).toBe(false);
    expect(eventCreateFieldsSchema.safeParse({ ...base, participant_capacity: 0 }).success).toBe(false);
  });

  it("accepts approval and hosts", () => {
    const parsed = eventCreateFieldsSchema.parse({
      ...base,
      require_participant_approval: true,
      organizer_affiliation: "Plug and Play, VLight",
    });
    expect(parsed.require_participant_approval).toBe(true);
    expect(parsed.organizer_affiliation).toBe("Plug and Play, VLight");
  });
});

describe("buildEventInsert", () => {
  it("maps fields and pins ownership and moderation defaults", () => {
    const insert = buildEventInsert(
      eventCreateFieldsSchema.parse({
        ...base,
        slug: "spring",
        require_participant_approval: true,
        organizer_affiliation: "  Stanford CEO Club ",
        event_schedule: [{ time: "Fri", events: [] }],
      }),
      "user-1"
    );
    expect(insert).toMatchObject({
      event_name: "Spring Hack",
      slug: "spring",
      owner_id: "user-1",
      approval_status: "not_submitted",
      featured: false,
      require_participant_approval: true,
      organizer_affiliation: "Stanford CEO Club",
      event_schedule: [{ time: "Fri", events: [] }],
      rules: [],
      paid: false,
      event_type: [],
    });
  });

  it("leaves the schedule out when none is given and nulls empty hosts", () => {
    const insert = buildEventInsert(eventCreateFieldsSchema.parse({ ...base, organizer_affiliation: " " }), "u");
    expect("event_schedule" in insert).toBe(false);
    expect(insert.organizer_affiliation).toBeNull();
    expect(insert.require_participant_approval).toBe(false);
  });
});

describe("isSlugTakenError", () => {
  it("spots the unique violation on the slug", () => {
    expect(isSlugTakenError({ message: 'duplicate key value violates unique constraint "events_slug_key"' })).toBe(true);
    expect(isSlugTakenError({ code: "23505", message: "Key (slug)=(x) already exists." })).toBe(true);
    expect(isSlugTakenError({ code: "23505", message: "Key (event_id)" })).toBe(false);
    expect(isSlugTakenError(null)).toBe(false);
  });
});
