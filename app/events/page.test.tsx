/** @jest-environment node */
import React from "react";
import EventsPage from "./page";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventsPageClient } from "@/components/eventsPageClient";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
jest.mock("@/components/ui/discord-cta", () => ({ DiscordCTA: () => null }));
jest.mock("@/components/eventsPageClient", () => ({
  EventsPageClient: () => null,
}));

const PRIVATE_COLUMNS = [
  "paywall_content",
  "submitter_email",
  "submitter_name",
  "organizer_affiliation",
];

const EVENT_ROW = {
  event_id: "event-1",
  event_name: "Listed Event",
  slug: "listed-event",
  event_date: "2026-12-01",
  location: "Online",
  visibility: "public",
  event_type: ["hackathon"],
  featured: false,
  external_url: "https://example.com/event",
  external_redirect_enabled: true,
  paywall_content: "SECRET participant-only content",
  submitter_email: "submitter@example.com",
  submitter_name: "Sample Submitter",
  organizer_affiliation: "Sample University",
};

/** Honours the requested column list, as PostgREST does. */
function project(row: Record<string, unknown>, columns: string) {
  if (columns === "*") return row;
  const names = columns.split(",").map((column) => column.trim());
  return Object.fromEntries(
    Object.entries(row).filter(([column]) => names.includes(column))
  );
}

function makeSupabase(user: { id: string } | null) {
  const makeQuery = (table: string) => {
    let columns = "";
    const query = {
      select: (requested: string) => {
        columns = requested;
        return query;
      },
      eq: () => query,
      in: () => query,
      order: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        resolve(
          table === "events"
            ? { data: [project(EVENT_ROW, columns)], error: null }
            : { data: [], error: null }
        ),
    };
    return query;
  };

  return {
    from: jest.fn(makeQuery),
    rpc: jest.fn(async () => ({ data: false })),
    auth: { getUser: jest.fn(async () => ({ data: { user } })) },
  };
}

function findEventsList(node: React.ReactNode): Record<string, unknown>[] | null {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement(child)) continue;
    const props = child.props as {
      children?: React.ReactNode;
      eventsList?: Record<string, unknown>[];
    };
    if (child.type === EventsPageClient) return props.eventsList ?? null;
    const found = findEventsList(props.children);
    if (found) return found;
  }
  return null;
}

describe("EventsPage listing payload", () => {
  it.each([
    ["anonymous visitors", null],
    ["signed-in users", { id: "user-1" }],
  ])("sends only display columns to %s", async (_label, user) => {
    (createSupabaseClient as jest.Mock).mockResolvedValue(makeSupabase(user));

    const eventsList = findEventsList(await EventsPage());

    expect(eventsList).toHaveLength(1);
    for (const column of PRIVATE_COLUMNS) {
      expect(eventsList?.[0]).not.toHaveProperty(column);
    }
    expect(eventsList?.[0]).toMatchObject({
      event_id: "event-1",
      event_name: "Listed Event",
      slug: "listed-event",
      event_date: "2026-12-01",
      location: "Online",
      visibility: "public",
      event_type: ["hackathon"],
      featured: false,
      external_url: "https://example.com/event",
      external_redirect_enabled: true,
    });
  });
});
