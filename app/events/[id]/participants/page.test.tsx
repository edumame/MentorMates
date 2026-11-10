import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import PublicParticipantsPage from "./page";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { fakeEventUsersResponse } from "@/lib/events/fake-event-users-api";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/events/resolve-event-route", () => ({
  resolveEventRouteId: async () => "event-1",
}));

jest.mock("next/navigation", () => ({ notFound: jest.fn() }));

jest.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000", cookie: "a=b" }),
}));

jest.mock("@/components/events/event-page-layout", () => ({
  EventPageLayout: ({ children }: { children: React.ReactNode }) => children,
}));

function mockSupabase(viewerRole: string) {
  const query = (result: unknown) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => result,
      maybeSingle: async () => result,
    };
    return builder;
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    from: (table: string) =>
      table === "events"
        ? query({
            data: { event_id: "event-1", event_name: "Hack", role_labels: null },
            error: null,
          })
        : query({ data: { role: viewerRole }, error: null }),
    auth: { getUser: async () => ({ data: { user: { id: "viewer" } } }) },
    rpc: async () => ({ data: false }),
  });
}

async function renderPage() {
  const page = (await PublicParticipantsPage({
    params: Promise.resolve({ id: "hack" }),
  })) as ReactElement;
  render(page);
}

describe("PublicParticipantsPage", () => {
  beforeEach(() => {
    // jsdom has no fetch for jest.spyOn to wrap.
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists every member and counts them all on the role chips", async () => {
    mockSupabase("organizer");
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async (input) =>
          fakeEventUsersResponse(String(input), 501) as unknown as Response
      );

    await renderPage();

    expect(screen.getByRole("tab", { name: /^all/i })).toHaveTextContent("501");
    expect(screen.getByText("Person 500")).toBeInTheDocument();
    for (const [, init] of fetchSpy.mock.calls) {
      expect(init).toMatchObject({
        cache: "no-store",
        headers: { cookie: "a=b" },
      });
    }
  });

  it("logs and renders no partial list when a later page fails", async () => {
    mockSupabase("participant");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("offset=500")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        } as unknown as Response;
      }
      return fakeEventUsersResponse(String(input), 501) as unknown as Response;
    });

    await renderPage();

    expect(consoleError).toHaveBeenCalled();
    expect(screen.queryByText("Person 0")).not.toBeInTheDocument();
  });
});
