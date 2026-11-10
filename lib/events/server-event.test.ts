import { getEventForRoute } from "./server-event";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("server-only", () => ({}));
// React owns request memoization in server renders. Unit tests execute the
// lookup directly; they do not claim to emulate React's request dispatcher.
jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));

function setup() {
  const result = { data: { event_id: "event" }, error: null };
  const query: { select: jest.Mock; eq: jest.Mock; or: jest.Mock; maybeSingle: jest.Mock } = {
    select: jest.fn(() => query), eq: jest.fn(() => query),
    or: jest.fn(() => query), maybeSingle: jest.fn(async () => result),
  };
  const from = jest.fn(() => query);
  jest.mocked(createSupabaseClient).mockResolvedValue({ from } as never);
  return { query, result, from };
}

it("resolves a slug through the cookie-bound client and preserves the database result", async () => {
  const { query, result, from } = setup();
  expect(await getEventForRoute("stanford")).toBe(result);
  expect(from).toHaveBeenCalledWith("events");
  expect(query.eq).toHaveBeenCalledWith("slug", "stanford");
  expect(query.or).not.toHaveBeenCalled();
});

it("resolves a UUID by event_id first so a UUID-shaped slug cannot shadow it", async () => {
  const { query, result } = setup();
  const id = "123e4567-e89b-42d3-a456-426614174000";
  expect(await getEventForRoute(id)).toBe(result);
  expect(query.eq).toHaveBeenCalledTimes(1);
  expect(query.eq).toHaveBeenCalledWith("event_id", id);
  expect(query.or).not.toHaveBeenCalled();
});

it("falls back to a slug lookup when no event has that UUID as its id", async () => {
  const { query, result } = setup();
  const id = "123e4567-e89b-42d3-a456-426614174000";
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect(await getEventForRoute(id)).toBe(result);
  expect(query.eq).toHaveBeenNthCalledWith(1, "event_id", id);
  expect(query.eq).toHaveBeenNthCalledWith(2, "slug", id);
});

it("never selects member-only paywall content for the shared route lookup", async () => {
  const { query } = setup();
  await getEventForRoute("stanford");
  expect(query.select.mock.calls[0][0]).not.toContain("paywall_content");
  expect(query.select.mock.calls[0][0]).toContain("approval_status");
});

it("preserves missing and denied event results without bypassing RLS", async () => {
  const { query } = setup();
  const missing = { data: null, error: null };
  query.maybeSingle.mockResolvedValueOnce(missing);
  expect(await getEventForRoute("missing")).toBe(missing);
  const denied = { data: null, error: { code: "42501", message: "denied" } };
  query.maybeSingle.mockResolvedValueOnce(denied);
  expect(await getEventForRoute("denied")).toBe(denied);
});
