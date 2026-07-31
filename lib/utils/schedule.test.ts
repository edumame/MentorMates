import {
  moveScheduleEvent,
  parseScheduleDragId,
  scheduleDayDropId,
  scheduleEventDragId,
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
