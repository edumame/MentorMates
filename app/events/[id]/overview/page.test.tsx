/** @jest-environment node */
import React from "react";
import EventOverviewPage from "./page";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventPageContent } from "@/components/events/event-page-content";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/app/utils/supabase/queries", () => ({
  isValidUUID: () => false,
}));
jest.mock("next/navigation", () => ({ notFound: jest.fn() }));
jest.mock("@/components/events/event-page-layout", () => ({
  EventPageLayout: () => null,
}));
jest.mock("@/components/events/event-page-content", () => ({
  EventPageContent: () => null,
}));
jest.mock("@/components/events/event-page-sidebar", () => ({
  EventPageSidebar: () => null,
}));

const PAYWALL_TEXT = "SECRET participant-only content";

const EVENT_ROW = {
  event_id: "event-1",
  event_name: "Paid Hack",
  slug: "paid-hack",
  event_date: "2026-12-01",
  location: "Online",
  paywall_content: PAYWALL_TEXT,
};

/** Honours the requested column list, as PostgREST does, so a column only reaches the page if it was asked for. */
function project(row: Record<string, unknown>, columns: string) {
  const names = columns.split(",").map((column) => column.trim());
  return Object.fromEntries(
    Object.entries(row).filter(([column]) => names.includes(column))
  );
}

function makeSupabase({
  user,
  role,
}: {
  user: { id: string; email: string } | null;
  role: string | null;
}) {
  const selects: Record<string, string[]> = {};

  const makeQuery = (table: string) => {
    let columns = "";
    const query = {
      select: (requested: string) => {
        columns = requested;
        (selects[table] ??= []).push(requested);
        return query;
      },
      eq: () => query,
      or: () => query,
      single: async () => ({ data: project(EVENT_ROW, columns), error: null }),
      maybeSingle: async () =>
        table === "user_event_roles"
          ? { data: role ? { role } : null, error: null }
          : { data: project(EVENT_ROW, columns), error: null },
      then: (resolve: (value: { data: unknown[] }) => unknown) =>
        resolve({ data: [] }),
    };
    return query;
  };

  return {
    selects,
    from: jest.fn(makeQuery),
    auth: { getUser: jest.fn(async () => ({ data: { user } })) },
  };
}

function findElement(
  node: React.ReactNode,
  type: unknown
): React.ReactElement<{ event: Record<string, unknown>; hasJoined: boolean }> | null {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement(child)) continue;
    if (child.type === type) {
      return child as React.ReactElement<{
        event: Record<string, unknown>;
        hasJoined: boolean;
      }>;
    }
    const found = findElement(
      (child.props as { children?: React.ReactNode }).children,
      type
    );
    if (found) return found;
  }
  return null;
}

async function renderContentProps(supabase: ReturnType<typeof makeSupabase>) {
  (createSupabaseClient as jest.Mock).mockResolvedValue(supabase);
  const page = await EventOverviewPage({
    params: Promise.resolve({ id: "paid-hack" }),
  });
  const content = findElement(page, EventPageContent);
  if (!content) throw new Error("EventPageContent was not rendered");
  return content.props;
}

describe("EventOverviewPage paywall content", () => {
  it("never queries or serializes paywall_content for anonymous visitors", async () => {
    const supabase = makeSupabase({ user: null, role: null });

    const props = await renderContentProps(supabase);

    expect(props.hasJoined).toBe(false);
    expect(props.event).not.toHaveProperty("paywall_content");
    expect(JSON.stringify(props)).not.toContain(PAYWALL_TEXT);
    expect(supabase.selects.events.join(",")).not.toContain("paywall_content");
  });

  it("never queries or serializes paywall_content for signed-in non-members", async () => {
    const supabase = makeSupabase({
      user: { id: "user-1", email: "visitor@example.com" },
      role: null,
    });

    const props = await renderContentProps(supabase);

    expect(props.hasJoined).toBe(false);
    expect(props.event).not.toHaveProperty("paywall_content");
    expect(JSON.stringify(props)).not.toContain(PAYWALL_TEXT);
    expect(supabase.selects.events.join(",")).not.toContain("paywall_content");
  });

  it("passes paywall_content to users who have joined the event", async () => {
    const supabase = makeSupabase({
      user: { id: "user-2", email: "member@example.com" },
      role: "participant",
    });

    const props = await renderContentProps(supabase);

    expect(props.hasJoined).toBe(true);
    expect(props.event.paywall_content).toBe(PAYWALL_TEXT);
  });
});
