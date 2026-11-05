/** @jest-environment node */
import type React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EVENT_REQUEST_PATHNAME_HEADER } from "@/lib/events/navigation";
import { EventRole } from "@/lib/types";
import Layout from "./layout";

jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
  redirect: jest.fn(),
}));
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/app/utils/supabase/queries", () => ({
  isValidUUID: jest.fn(() => false),
}));
jest.mock("./conditional-event-layout", () => ({
  ConditionalEventLayout: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock("./RouteBasedLayoutConfig", () => ({
  RouteBasedLayoutConfig: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const EXTERNAL_URL = "https://partner.example.com/hack";

function mockSupabase({
  user = null,
  role = null,
  isAdmin = false,
  externalRedirectEnabled = true,
}: {
  user?: { id: string } | null;
  role?: EventRole | null;
  isAdmin?: boolean;
  externalRedirectEnabled?: boolean;
} = {}) {
  const eventQuery = {
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        event_id: "event-123",
        slug: "partner-event",
        external_url: ` ${EXTERNAL_URL} `,
        external_redirect_enabled: externalRedirectEnabled,
      },
    }),
  };
  const roleQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: role ? { role } : null,
    }),
  };

  jest.mocked(createSupabaseClient).mockResolvedValue({
    from: jest.fn((table: string) =>
      table === "events" ? { select: () => eventQuery } : roleQuery
    ),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    rpc: jest.fn().mockResolvedValue({ data: isAdmin }),
  } as never);
}

async function renderAt(pathname: string | null) {
  jest
    .mocked(headers)
    .mockResolvedValue(
      new Headers(
        pathname ? { [EVENT_REQUEST_PATHNAME_HEADER]: pathname } : {}
      ) as never
    );

  await Layout({
    children: null,
    params: Promise.resolve({ id: "partner-event" }),
  });
}

describe("event layout external redirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["accept", "accept-judge", "accept-organizer", "accept-participant"])(
    "keeps /%s reachable for a logged-out invitee",
    async (segment) => {
      mockSupabase();

      await renderAt(`/events/partner-event/${segment}`);

      expect(redirect).not.toHaveBeenCalled();
    }
  );

  it("keeps accept routes reachable for a signed-in invitee with no role yet", async () => {
    mockSupabase({ user: { id: "user-1" } });

    await renderAt("/events/partner-event/accept-organizer");

    expect(redirect).not.toHaveBeenCalled();
  });

  it("lets a judge reach the event page where scoring lives", async () => {
    mockSupabase({ user: { id: "user-1" }, role: EventRole.Judge });

    await renderAt("/events/partner-event/overview");

    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(["overview", "tickets", "gallery"])(
    "still redirects anonymous visitors from /%s",
    async (segment) => {
      mockSupabase();

      await renderAt(`/events/partner-event/${segment}`);

      expect(redirect).toHaveBeenCalledWith(EXTERNAL_URL);
    }
  );

  it("still redirects participants", async () => {
    mockSupabase({ user: { id: "user-1" }, role: EventRole.Participant });

    await renderAt("/events/partner-event/overview");

    expect(redirect).toHaveBeenCalledWith(EXTERNAL_URL);
  });

  it("still lets organizers and global admins through", async () => {
    mockSupabase({ user: { id: "user-1" }, role: EventRole.Organizer });
    await renderAt("/events/partner-event/overview");

    mockSupabase({ user: { id: "user-2" }, isAdmin: true });
    await renderAt("/events/partner-event/overview");

    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects when the pathname header is missing", async () => {
    mockSupabase();

    await renderAt(null);

    expect(redirect).toHaveBeenCalledWith(EXTERNAL_URL);
  });

  it("does not redirect when the toggle is off", async () => {
    mockSupabase({ externalRedirectEnabled: false });

    await renderAt("/events/partner-event/overview");

    expect(redirect).not.toHaveBeenCalled();
  });
});
