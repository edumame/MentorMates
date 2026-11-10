/**
 * Popular-vote window (events.voting_opens_at / voting_closes_at).
 * A null bound means "no restriction on that side". The database enforces the
 * same rule in public.assert_popular_voting_open; this helper drives the UI and
 * the API's canVote flag.
 */

export type VotingWindowStatus = "open" | "not_open" | "closed";

export interface VotingWindow {
  opensAt: string | null;
  closesAt: string | null;
}

export interface VotingWindowState {
  status: VotingWindowStatus;
  message: string | null;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function formatVotingTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function getVotingWindowState(
  window: Partial<VotingWindow> | null | undefined,
  now: Date = new Date()
): VotingWindowState {
  const opens = parseTime(window?.opensAt);
  const closes = parseTime(window?.closesAt);
  const current = now.getTime();

  if (opens !== null && current < opens) {
    return {
      status: "not_open",
      message: `Voting opens ${formatVotingTime(window!.opensAt!)}.`,
    };
  }

  if (closes !== null && current >= closes) {
    return {
      status: "closed",
      message: "Voting has closed.",
    };
  }

  return {
    status: "open",
    message:
      closes !== null
        ? `Voting closes ${formatVotingTime(window!.closesAt!)}.`
        : null,
  };
}

/** Returns an error message when the window is invalid, otherwise null. */
export function validateVotingWindow(window: VotingWindow): string | null {
  const opens = window.opensAt === null ? null : parseTime(window.opensAt);
  const closes = window.closesAt === null ? null : parseTime(window.closesAt);

  if (window.opensAt !== null && opens === null) return "Invalid voting open time";
  if (window.closesAt !== null && closes === null) return "Invalid voting close time";
  if (opens !== null && closes !== null && opens >= closes) {
    return "Voting must open before it closes";
  }
  return null;
}

/** ISO instant -> `<input type="datetime-local">` value in the viewer's timezone. */
export function toDateTimeLocalValue(value: string | null | undefined): string {
  const time = parseTime(value);
  if (time === null) return "";
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** `<input type="datetime-local">` value (viewer's timezone) -> ISO instant, or null when empty/invalid. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
