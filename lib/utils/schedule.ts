export interface ScheduleEventPosition {
  dayIndex: number;
  eventIndex: number;
}

/**
 * Moves an event between positions in a day-grouped schedule, supporting both
 * same-day reordering and cross-day moves. Returns a new schedule array
 * (original days/events arrays are not mutated), or the original array if the
 * positions are invalid or identical.
 */
export function moveScheduleEvent<TDay extends { events: unknown[] }>(
  schedule: TDay[],
  from: ScheduleEventPosition,
  to: ScheduleEventPosition
): TDay[] {
  const sourceDay = schedule[from.dayIndex];
  const targetDay = schedule[to.dayIndex];

  if (!sourceDay || !targetDay) return schedule;
  if (from.eventIndex < 0 || from.eventIndex >= sourceDay.events.length) {
    return schedule;
  }
  if (from.dayIndex === to.dayIndex && from.eventIndex === to.eventIndex) {
    return schedule;
  }

  const next = [...schedule];
  const sourceEvents = [...sourceDay.events];
  const [moved] = sourceEvents.splice(from.eventIndex, 1);

  if (from.dayIndex === to.dayIndex) {
    const insertAt = Math.max(0, Math.min(to.eventIndex, sourceEvents.length));
    sourceEvents.splice(insertAt, 0, moved);
    next[from.dayIndex] = { ...sourceDay, events: sourceEvents };
    return next;
  }

  const targetEvents = [...targetDay.events];
  const insertAt = Math.max(0, Math.min(to.eventIndex, targetEvents.length));
  targetEvents.splice(insertAt, 0, moved);
  next[from.dayIndex] = { ...sourceDay, events: sourceEvents };
  next[to.dayIndex] = { ...targetDay, events: targetEvents };
  return next;
}

/** Builds the sortable id for a schedule event card. */
export function scheduleEventDragId(
  dayIndex: number,
  eventIndex: number
): string {
  return `schedule-event-${dayIndex}-${eventIndex}`;
}

/** Generates a stable client-side id for a schedule event. */
export function createScheduleEventId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Returns a copy of the schedule with event ids removed, for comparing
 * schedule content while ignoring client-generated ids.
 */
export function stripScheduleEventIds<
  TDay extends { events: Array<{ id?: string }> },
>(schedule: TDay[]): TDay[] {
  return schedule.map((day) => ({
    ...day,
    events: day.events.map((ev) => {
      const rest = { ...ev };
      delete rest.id;
      return rest;
    }),
  }));
}

/**
 * Ensures every schedule event has a stable id, generating ids for legacy
 * data that lacks them. dnd-kit's sortable requires ids that survive
 * reordering; position-derived ids break its optimistic sorting. Returns the
 * original array unchanged (same reference) when all ids are already present.
 */
export function ensureScheduleEventIds<
  TDay extends { events: Array<{ id?: string }> },
>(schedule: TDay[]): TDay[] {
  let changed = false;
  const next = schedule.map((day) => {
    if (day.events.every((ev) => ev.id)) return day;
    changed = true;
    return {
      ...day,
      events: day.events.map((ev) =>
        ev.id ? ev : { ...ev, id: createScheduleEventId() }
      ),
    };
  });
  return changed ? next : schedule;
}

/** Builds the droppable id for an empty day's drop zone. */
export function scheduleDayDropId(dayIndex: number): string {
  return `schedule-day-${dayIndex}`;
}

/**
 * Parses a drag/drop id produced by scheduleEventDragId or scheduleDayDropId.
 * For a day drop zone, eventIndex is 0 (insert at the start of the day).
 */
export function parseScheduleDragId(
  id: string | number | undefined
): ScheduleEventPosition | null {
  if (typeof id !== "string") return null;

  const eventMatch = id.match(/^schedule-event-(\d+)-(\d+)$/);
  if (eventMatch) {
    return {
      dayIndex: Number(eventMatch[1]),
      eventIndex: Number(eventMatch[2]),
    };
  }

  const dayMatch = id.match(/^schedule-day-(\d+)$/);
  if (dayMatch) {
    return { dayIndex: Number(dayMatch[1]), eventIndex: 0 };
  }

  return null;
}
