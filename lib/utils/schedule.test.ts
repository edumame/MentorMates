import {
  ensureScheduleEventIds,
  moveScheduleEvent,
  parseScheduleDragId,
  scheduleDayDropId,
  scheduleEventDragId,
  stripScheduleEventIds,
} from "./schedule";

type TestDay = { title: string; events: string[] };

function makeSchedule(): TestDay[] {
  return [
    { title: "Day 1", events: ["a", "b", "c"] },
    { title: "Day 2", events: ["d", "e"] },
    { title: "Day 3", events: [] },
  ];
}

describe("moveScheduleEvent", () => {
  it("reorders an event within the same day (moving down)", () => {
    const result = moveScheduleEvent(
      makeSchedule(),
      { dayIndex: 0, eventIndex: 0 },
      { dayIndex: 0, eventIndex: 2 }
    );
    expect(result[0].events).toEqual(["b", "c", "a"]);
  });

  it("reorders an event within the same day (moving up)", () => {
    const result = moveScheduleEvent(
      makeSchedule(),
      { dayIndex: 0, eventIndex: 2 },
      { dayIndex: 0, eventIndex: 0 }
    );
    expect(result[0].events).toEqual(["c", "a", "b"]);
  });

  it("moves an event to another day at the target position", () => {
    const result = moveScheduleEvent(
      makeSchedule(),
      { dayIndex: 0, eventIndex: 1 },
      { dayIndex: 1, eventIndex: 1 }
    );
    expect(result[0].events).toEqual(["a", "c"]);
    expect(result[1].events).toEqual(["d", "b", "e"]);
  });

  it("moves an event into an empty day", () => {
    const result = moveScheduleEvent(
      makeSchedule(),
      { dayIndex: 1, eventIndex: 0 },
      { dayIndex: 2, eventIndex: 0 }
    );
    expect(result[1].events).toEqual(["e"]);
    expect(result[2].events).toEqual(["d"]);
  });

  it("clamps an out-of-range target index to the end of the day", () => {
    const result = moveScheduleEvent(
      makeSchedule(),
      { dayIndex: 0, eventIndex: 0 },
      { dayIndex: 1, eventIndex: 99 }
    );
    expect(result[1].events).toEqual(["d", "e", "a"]);
  });

  it("returns the original array for identical source and target", () => {
    const schedule = makeSchedule();
    const result = moveScheduleEvent(
      schedule,
      { dayIndex: 0, eventIndex: 1 },
      { dayIndex: 0, eventIndex: 1 }
    );
    expect(result).toBe(schedule);
  });

  it("returns the original array for invalid positions", () => {
    const schedule = makeSchedule();
    expect(
      moveScheduleEvent(
        schedule,
        { dayIndex: 5, eventIndex: 0 },
        { dayIndex: 0, eventIndex: 0 }
      )
    ).toBe(schedule);
    expect(
      moveScheduleEvent(
        schedule,
        { dayIndex: 0, eventIndex: 9 },
        { dayIndex: 1, eventIndex: 0 }
      )
    ).toBe(schedule);
  });

  it("does not mutate the input schedule", () => {
    const schedule = makeSchedule();
    moveScheduleEvent(
      schedule,
      { dayIndex: 0, eventIndex: 0 },
      { dayIndex: 1, eventIndex: 0 }
    );
    expect(schedule).toEqual(makeSchedule());
  });
});

describe("ensureScheduleEventIds", () => {
  it("generates unique ids for events that lack them", () => {
    const schedule: { events: { id?: string; name: string }[] }[] = [
      { events: [{ name: "a" }, { name: "b" }] },
      { events: [{ name: "c" }] },
    ];
    const result = ensureScheduleEventIds(schedule);
    const ids = result.flatMap((day) => day.events.map((ev) => ev.id));
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true
    );
    expect(new Set(ids).size).toBe(3);
  });

  it("preserves existing ids and untouched day references", () => {
    const schedule: { events: { id?: string; name: string }[] }[] = [
      { events: [{ id: "keep-me", name: "a" }] },
      { events: [{ name: "b" }] },
    ];
    const result = ensureScheduleEventIds(schedule);
    expect(result[0]).toBe(schedule[0]);
    expect(result[1].events[0].id).toBeDefined();
  });

  it("returns the same reference when all ids are present", () => {
    const schedule = [{ events: [{ id: "x", name: "a" }] }];
    expect(ensureScheduleEventIds(schedule)).toBe(schedule);
  });
});

describe("stripScheduleEventIds", () => {
  it("removes ids without touching other fields or the input", () => {
    const schedule = [
      { title: "Day 1", events: [{ id: "x", name: "a", time: "10:00" }] },
    ];
    const result = stripScheduleEventIds(schedule);
    expect(result[0].events[0]).toEqual({ name: "a", time: "10:00" });
    expect(schedule[0].events[0].id).toBe("x");
  });

  it("makes id-backfilled and id-less schedules compare equal", () => {
    const original: { events: { id?: string; name: string; time: string }[] }[] =
      [{ events: [{ name: "a", time: "1" }] }];
    const withIds = ensureScheduleEventIds(original);
    expect(JSON.stringify(stripScheduleEventIds(withIds))).toBe(
      JSON.stringify(original)
    );
  });
});

describe("drag id round-tripping", () => {
  it("parses an event drag id back into its position", () => {
    expect(parseScheduleDragId(scheduleEventDragId(2, 5))).toEqual({
      dayIndex: 2,
      eventIndex: 5,
    });
  });

  it("parses a day drop id as the start of that day", () => {
    expect(parseScheduleDragId(scheduleDayDropId(3))).toEqual({
      dayIndex: 3,
      eventIndex: 0,
    });
  });

  it("returns null for unknown ids", () => {
    expect(parseScheduleDragId("something-else")).toBeNull();
    expect(parseScheduleDragId(undefined)).toBeNull();
    expect(parseScheduleDragId(42)).toBeNull();
  });
});
