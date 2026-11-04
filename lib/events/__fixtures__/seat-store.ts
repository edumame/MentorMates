import type { ServiceSupabaseClient } from "@/lib/supabase/service";

type Row = Record<string, unknown>;

export interface SeatStoreSeed {
  participantCapacity: number | null;
  paid: boolean;
  /** user id -> role in the event */
  roles?: Record<string, string>;
  /** user id -> participant approval request status */
  requests?: Record<string, string>;
  /** Rows for any other table the path under test touches */
  extraTables?: Record<string, Row[]>;
  /** Tables whose reads and writes should fail */
  failingTables?: string[];
}

export const SEAT_STORE_EVENT_ID = "22222222-2222-4222-8222-222222222222";

/**
 * Small in-memory stand-in for the tables behind seat counting, so a test can
 * run a real leave path and then ask whether the seat really came back. It
 * supports only the query shapes those paths use.
 */
export function createSeatStore(seed: SeatStoreSeed) {
  const eventId = SEAT_STORE_EVENT_ID;
  const tables: Record<string, Row[]> = {
    ...seed.extraTables,
    events: [
      {
        event_id: eventId,
        participant_capacity: seed.participantCapacity,
        paid: seed.paid,
      },
    ],
    user_event_roles: Object.entries(seed.roles ?? {}).map(
      ([user_id, role]) => ({ event_id: eventId, user_id, role }),
    ),
    participant_approval_requests: Object.entries(seed.requests ?? {}).map(
      ([user_id, status]) => ({
        id: `request-${user_id}`,
        event_id: eventId,
        user_id,
        requested_role: "participant",
        status,
      }),
    ),
  };

  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let mutation: { type: "update"; values: Row } | { type: "delete" } | null =
      null;
    let window: [number, number] | null = null;

    const run = () => {
      if (seed.failingTables?.includes(table)) {
        return { data: null, error: { message: `${table} failed` } };
      }

      const rows = tables[table] ?? [];
      const matches = rows.filter((row) =>
        filters.every(([column, value]) => row[column] === value),
      );

      if (mutation?.type === "update") {
        const { values } = mutation;
        matches.forEach((row) => Object.assign(row, values));
      }
      if (mutation?.type === "delete") {
        tables[table] = rows.filter((row) => !matches.includes(row));
      }

      return {
        data: window ? matches.slice(window[0], window[1] + 1) : matches,
        error: null,
      };
    };

    const first = async () => {
      const { data, error } = run();
      return { data: data?.[0] ?? null, error };
    };

    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      range: (start: number, end: number) => {
        window = [start, end];
        return builder;
      },
      update: (values: Row) => {
        mutation = { type: "update", values };
        return builder;
      },
      delete: () => {
        mutation = { type: "delete" };
        return builder;
      },
      single: first,
      maybeSingle: first,
      then: (
        resolve: (value: ReturnType<typeof run>) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve().then(run).then(resolve, reject),
    };

    return builder;
  };

  return {
    client: { from } as unknown as ServiceSupabaseClient,
    eventId,
    rows: (table: string) => tables[table] ?? [],
    roleOf: (userId: string) =>
      tables.user_event_roles.find((row) => row.user_id === userId)?.role,
    requestStatusOf: (userId: string) =>
      tables.participant_approval_requests.find(
        (row) => row.user_id === userId,
      )?.status,
  };
}
