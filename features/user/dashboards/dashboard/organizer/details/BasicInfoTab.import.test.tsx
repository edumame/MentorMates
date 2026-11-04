import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BasicInfoTab } from "./BasicInfoTab";
import type { EventDetails } from "@/lib/types";

jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("react-markdown", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/markdown/plugins", () => ({
  markdownRemarkPlugins: [],
  markdownRehypePlugins: [],
}));
jest.mock("@/components/markdown/custom-components", () => ({
  customMarkdownComponents: {},
}));

const event = {
  event_id: "event-1",
  slug: "live-slug",
  event_name: "Old name",
  event_date: "2026-01-01",
  location: "Old venue",
  event_blurb: "Old blurb",
  event_description: "Old description",
  event_type: [],
  event_schedule: [{ time: "Existing day", events: [] }],
  rules: [{ title: "Existing rule", items: ["Keep me"] }],
  event_resources: [{ name: "Existing", link: "https://example.com" }],
  faq: [{ question: "Existing?", answer: "Yes" }],
  event_tracks: [{ track_id: "real-track", name: "Real track" }],
} as unknown as EventDetails;

const scraped = {
  slug: "scraped-slug",
  event_name: "New name",
  event_date: "2026-06-15",
  location: "New venue",
  event_blurb: null,
  event_description: "New description",
  submission_time_start: "2026-06-15T09:00:00",
  submission_time_cutoff: "not a date",
  event_schedule: [
    {
      date: "2026-06-15",
      events: [{ name: "Kickoff", time: "09:00", description: null }],
    },
  ],
  rules: [],
  event_resources: null,
  faqs: [{ question: "New?", answer: "Indeed" }],
  tracks: [{ name: "Scraped track", description: "Should stay out" }],
  prizes: [{ track_name: "Scraped track", name: "$1" }],
};

const fetchMock = jest.fn();
const originalFetch = global.fetch;

function renderTab() {
  const setEvent = jest.fn();
  const toast = jest.fn();
  render(
    <BasicInfoTab
      event={event}
      setEvent={setEvent}
      saving={false}
      setSaving={jest.fn()}
      toast={toast as never}
      router={{ refresh: jest.fn(), push: jest.fn() } as never}
    />,
  );
  return { setEvent, toast };
}

async function clickImport() {
  fireEvent.change(screen.getByPlaceholderText("https://<event>.devpost.com/"), {
    target: { value: " https://sample.devpost.com/ " },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
  });
}

const htmlResponse = (status: number) => ({
  ok: false,
  status,
  json: async () => {
    throw new SyntaxError("Unexpected token <");
  },
});

function respondWith(status: number, body: unknown) {
  fetchMock.mockImplementation(async (url: string) => {
    const route = join(process.cwd(), "app", url, "route.ts");
    return existsSync(route)
      ? { ok: status < 400, status, json: async () => body }
      : htmlResponse(404);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  global.fetch = originalFetch;
});

it("imports through a route that exists, with a body that route accepts", async () => {
  respondWith(200, { success: true, data: scraped, error: null });
  const { setEvent, toast } = renderTab();
  await clickImport();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/scrape");
  // The route's schema is strict, so an extra key such as eventId is a 400.
  expect(JSON.parse(init.body)).toEqual({
    url: "https://sample.devpost.com/",
    browserProfile: "lite",
  });
  await waitFor(() => expect(setEvent).toHaveBeenCalledTimes(1));
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Imported" }),
  );
});

it("merges into the latest event state, so edits made during a long scrape survive", async () => {
  respondWith(200, { success: true, data: scraped, error: null });
  const { setEvent } = renderTab();
  await clickImport();

  const update = setEvent.mock.calls[0][0];
  expect(typeof update).toBe("function");
  const merged = update({ ...event, external_url: "https://edited.example" });
  expect(merged.external_url).toBe("https://edited.example");
  expect(merged.event_name).toBe("New name");
  expect(update(null)).toBeNull();
});

it("does not repoint the live event URL or replace saved tracks", async () => {
  respondWith(200, { success: true, data: scraped, error: null });
  const { setEvent } = renderTab();
  await clickImport();

  const merged = setEvent.mock.calls[0][0](event);
  expect(merged.slug).toBe("live-slug");
  expect(merged.event_tracks).toBe(event.event_tracks);
});

it("tells the organizer which tabs still need saving", async () => {
  respondWith(200, { success: true, data: scraped, error: null });
  const { toast } = renderTab();
  await clickImport();

  const { description } = toast.mock.calls[0][0];
  expect(description).toMatch(/Schedule, Resources, Rules and FAQs/);
  expect(description).toMatch(/Tracks and prizes are not imported/);
});

it("surfaces the route's error and leaves the event alone", async () => {
  respondWith(429, {
    success: false,
    error: "Import limit reached. Try again later.",
    data: null,
  });
  const { setEvent, toast } = renderTab();
  await clickImport();

  expect(setEvent).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Import failed",
      description: "Import limit reached. Try again later.",
      variant: "destructive",
    }),
  );
});

it("falls back to a generic message when the error body is not JSON", async () => {
  fetchMock.mockResolvedValue(htmlResponse(502));
  const { setEvent, toast } = renderTab();
  await clickImport();

  expect(setEvent).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ description: "Failed to import Devpost data" }),
  );
});

it("does not claim success when the page yielded nothing usable", async () => {
  respondWith(200, {
    success: true,
    data: { slug: "only-slug", event_name: null, rules: [], tracks: [] },
    error: null,
  });
  const { setEvent, toast } = renderTab();
  await clickImport();

  expect(setEvent).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Import failed" }),
  );
});
