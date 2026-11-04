/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

type Op = [string, unknown[]];

const slots = [
  { id: "s1", mentor_id: "mentor-a", event_id: "event-1", max_bookings: 2 },
  { id: "s2", mentor_id: "mentor-b", event_id: "event-1", max_bookings: 2 },
  { id: "s3", mentor_id: "mentor-a", event_id: "event-1", max_bookings: 2 },
];
const alice = { display_name: "Alice", email: "alice@example.test" };
const bob = { display_name: "Bob", email: "bob@example.test" };
const profiles = [
  { uid: "alice", ...alice, avatar_url: null },
  { uid: "bob", ...bob, avatar_url: null },
  { uid: "mentor-a", display_name: "A", email: "a@example.test", avatar_url: null },
  { uid: "mentor-b", display_name: "B", email: "b@example.test", avatar_url: null },
];

let viewer: string;
let role: string | null;
let bookings: Array<Record<string, string>>;
let profileQueries: Op[][];

function serviceFrom(table: string) {
  const ops: Op[] = [];
  if (table === "user_profiles") profileQueries.push(ops);

  const result = () => {
    if (table === "mentor_availability") return { data: slots, error: null };
    if (table === "mentor_bookings") return { data: bookings, error: null };
    if (table === "user_profiles") {
      const uids = ops.find(([op]) => op === "in")?.[1][1] as string[];
      const columns = (ops.find(([op]) => op === "select")?.[1][0] as string)
        .split(",")
        .map((column) => column.trim());
      return {
        data: profiles
          .filter((profile) => uids.includes(profile.uid))
          .map((profile) =>
            Object.fromEntries(
              Object.entries(profile).filter(([key]) => columns.includes(key))
            )
          ),
        error: null,
      };
    }
    throw new Error(`Unexpected table ${table}`);
  };

  const chain: Record<string, unknown> = {};
  for (const op of ["select", "eq", "in", "order"]) {
    chain[op] = (...args: unknown[]) => {
      ops.push([op, args]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve);
  return chain;
}

function callerFrom() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({
      data: role ? { role } : null,
      error: null,
    }),
  };
  return chain;
}

async function fetchSlots() {
  const response = await GET(
    new NextRequest("https://example.test/api/events/event-1/mentor-availability"),
    { params: Promise.resolve({ eventId: "event-1" }) }
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  return {
    raw: JSON.stringify(body),
    byId: Object.fromEntries(
      body.availability.map((slot: { id: string }) => [slot.id, slot])
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  profileQueries = [];
  viewer = "carol";
  role = "participant";
  bookings = [
    { id: "b1", availability_id: "s1", participant_id: "alice", status: "confirmed" },
    { id: "b2", availability_id: "s2", participant_id: "bob", status: "confirmed" },
  ];
  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: viewer } }, error: null }),
    },
    from: callerFrom,
  } as never);
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue({ from: serviceFrom } as never);
});

describe("GET mentor-availability booker privacy", () => {
  it("gives a participant no booker identities but keeps the counts", async () => {
    const { raw, byId } = await fetchSlots();

    expect(byId.s1.participants).toEqual([]);
    expect(byId.s2.participants).toEqual([]);
    expect(byId.s1.booking_count).toBe(1);
    expect(byId.s2.booking_count).toBe(1);
    expect(raw).not.toContain("alice@example.test");
    expect(raw).not.toContain("bob@example.test");
  });

  it("does not look up booker profiles the viewer may not see", async () => {
    await fetchSlots();

    const requestedUids = profileQueries.flatMap((ops) =>
      ops.flatMap(([op, args]) => (op === "in" ? (args[1] as string[]) : []))
    );
    expect(requestedUids).not.toContain("alice");
    expect(requestedUids).not.toContain("bob");
  });

  it("does not show a booker their co-bookers, but keeps their own booking id", async () => {
    viewer = "alice";
    bookings.push({
      id: "b3",
      availability_id: "s1",
      participant_id: "bob",
      status: "confirmed",
    });

    const { byId } = await fetchSlots();

    expect(byId.s1.participants).toEqual([]);
    expect(byId.s1.viewer_booking_id).toBe("b1");
    expect(byId.s1.booking_count).toBe(2);
  });

  it("gives a mentor only the bookers of their own slots, per slot", async () => {
    viewer = "mentor-a";
    role = "mentor";

    const { raw, byId } = await fetchSlots();

    expect(byId.s1.participants).toEqual([alice]);
    expect(byId.s2.participants).toEqual([]);
    expect(byId.s3.participants).toEqual([]);
    expect(raw).not.toContain("bob@example.test");
  });

  it.each(["organizer", "admin"])(
    "gives an event %s each slot's own bookers",
    async (eventRole) => {
      viewer = "staff";
      role = eventRole;

      const { byId } = await fetchSlots();

      expect(byId.s1.participants).toEqual([alice]);
      expect(byId.s2.participants).toEqual([bob]);
      expect(byId.s3.participants).toEqual([]);
    }
  );

  it("lists a booker on every slot they booked", async () => {
    viewer = "mentor-a";
    role = "mentor";
    bookings.push({
      id: "b3",
      availability_id: "s3",
      participant_id: "alice",
      status: "confirmed",
    });

    const { byId } = await fetchSlots();

    expect(byId.s1.participants).toEqual([alice]);
    expect(byId.s3.participants).toEqual([alice]);
  });

  it("skips a booking whose profile no longer exists", async () => {
    viewer = "mentor-a";
    role = "mentor";
    bookings.push({
      id: "b3",
      availability_id: "s1",
      participant_id: "deleted-user",
      status: "confirmed",
    });

    const { byId } = await fetchSlots();

    expect(byId.s1.participants).toEqual([alice]);
    expect(byId.s1.booking_count).toBe(2);
  });
});
