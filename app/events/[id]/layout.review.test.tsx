/** @jest-environment node */
import { notFound, redirect } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import Layout, { generateMetadata } from "./layout";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
// getEventForRoute wraps React's server-only cache(); call the lookup directly.
jest.mock("@/lib/events/server-event", () => ({
  getEventForRoute: async (id: string) => {
    const { createSupabaseClient } = jest.requireMock("@/app/utils/supabase/server");
    const supabase = await createSupabaseClient();
    return supabase.from("events").select("*").eq("slug", id).maybeSingle();
  },
}));
jest.mock("./conditional-event-layout", () => ({
  ConditionalEventLayout: () => null,
}));
jest.mock("./RouteBasedLayoutConfig", () => ({
  RouteBasedLayoutConfig: () => null,
}));

const ATTACKER_URL = "https://attacker.example";

const baseEvent = {
  event_id: "event-1",
  slug: "demo-day",
  event_name: "Demo Day",
  event_blurb: "Unreviewed blurb",
  owner_id: null as string | null,
  visibility: EventVisibility.Public,
  approval_status: ApprovalStatus.Approved,
  external_url: ATTACKER_URL,
  external_redirect_enabled: true,
};

function mockSupabase({
  event = {},
  user = null,
  role = null,
  isAdmin = false,
}: {
  event?: Partial<typeof baseEvent>;
  user?: { id: string } | null;
  role?: EventRole | null;
  isAdmin?: boolean;
}) {
  const row = { ...baseEvent, ...event };
  const eventsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
    single: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
  const rolesQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: role ? { role } : null,
      error: null,
    }),
  };

  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: jest.fn().mockResolvedValue({ data: isAdmin }),
    from: (table: string) =>
      table === "events" ? eventsQuery : rolesQuery,
  } as never);
}

const renderLayout = () =>
  Layout({ children: null, params: Promise.resolve({ id: "demo-day" }) });

describe("event layout approval gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([ApprovalStatus.Submitted, ApprovalStatus.Rejected])(
    "returns 404 without redirecting anonymous visitors of a %s public event",
    async (approval_status) => {
      mockSupabase({ event: { approval_status } });

      await expect(renderLayout()).rejects.toThrow("NEXT_NOT_FOUND");

      expect(redirect).not.toHaveBeenCalled();
    }
  );

  it("returns 404 for a pending public event that has no redirect", async () => {
    mockSupabase({
      event: {
        approval_status: ApprovalStatus.Submitted,
        external_redirect_enabled: false,
      },
    });

    await expect(renderLayout()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("returns 404 for signed-in users with no management rights", async () => {
    mockSupabase({
      event: { approval_status: ApprovalStatus.Submitted },
      user: { id: "user-1" },
      role: EventRole.Participant,
    });

    await expect(renderLayout()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["a global admin", { isAdmin: true }],
    ["an event organizer", { role: EventRole.Organizer }],
    ["the submitter", { owner_id: "user-1" }],
  ])("renders a pending public event for %s", async (_label, access) => {
    const { owner_id = null, ...roleAccess } = access as {
      owner_id?: string;
      isAdmin?: boolean;
      role?: EventRole;
    };
    mockSupabase({
      user: { id: "user-1" },
      ...roleAccess,
      event: { approval_status: ApprovalStatus.Submitted, owner_id },
    });

    await expect(renderLayout()).resolves.toBeDefined();

    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not redirect from a public event whose status was reset to not_submitted", async () => {
    mockSupabase({ event: { approval_status: ApprovalStatus.NotSubmitted } });

    await expect(renderLayout()).resolves.toBeDefined();

    expect(redirect).not.toHaveBeenCalled();
  });

  it("still redirects visitors of an approved public event", async () => {
    mockSupabase({});

    await expect(renderLayout()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith(ATTACKER_URL);
  });

  it("keeps the internal page for managers of an approved event", async () => {
    mockSupabase({ user: { id: "user-1" }, role: EventRole.Organizer });

    await expect(renderLayout()).resolves.toBeDefined();

    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ApprovalStatus.NotSubmitted,
    ApprovalStatus.Submitted,
    ApprovalStatus.Rejected,
  ])(
    // getExternalRedirectUrl only follows approved external links (allow-list).
    "renders %s private events internally without redirecting or hiding them",
    async (approval_status) => {
      mockSupabase({
        event: { visibility: EventVisibility.Private, approval_status },
      });

      await expect(renderLayout()).resolves.toBeTruthy();

      expect(redirect).not.toHaveBeenCalled();
      expect(notFound).not.toHaveBeenCalled();
    }
  );

  it("renders a private event awaiting review for visitors with no redirect", async () => {
    mockSupabase({
      event: {
        visibility: EventVisibility.Private,
        approval_status: ApprovalStatus.Submitted,
        external_redirect_enabled: false,
      },
    });

    await expect(renderLayout()).resolves.toBeDefined();

    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("event layout metadata", () => {
  const metadata = () =>
    generateMetadata({ params: Promise.resolve({ id: "demo-day" }) });

  it.each([ApprovalStatus.Submitted, ApprovalStatus.Rejected])(
    "does not publish the details of a %s public event",
    async (approval_status) => {
      mockSupabase({ event: { approval_status } });

      const result = await metadata();

      expect(JSON.stringify(result)).not.toContain("Demo Day");
      expect(JSON.stringify(result)).not.toContain("Unreviewed blurb");
    }
  );

  it("keeps the details of an approved event", async () => {
    mockSupabase({});

    await expect(metadata()).resolves.toMatchObject({
      title: "Demo Day",
      description: "Unreviewed blurb",
    });
  });
});
