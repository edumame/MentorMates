/** @jest-environment node */

import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import Layout from "./layout";

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
  ConditionalEventLayout: () => null,
}));

jest.mock("./RouteBasedLayoutConfig", () => ({
  RouteBasedLayoutConfig: () => null,
}));

const renderLayoutFor = async (event: Record<string, unknown>) => {
  const select = jest.fn(() => ({
    eq: jest.fn(() => ({
      maybeSingle: jest.fn().mockResolvedValue({ data: event, error: null }),
    })),
  }));

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    from: jest.fn(() => ({ select })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  });

  await Layout({ children: null, params: Promise.resolve({ id: "listing" }) });

  return select;
};

describe("event layout external redirect", () => {
  const redirectingEvent = {
    event_id: "event-1",
    slug: "listing",
    visibility: "public",
    external_url: "https://example.com/listing",
    external_redirect_enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends anonymous visitors to the external URL", async () => {
    await renderLayoutFor({ ...redirectingEvent, approval_status: "approved" });

    expect(redirect).toHaveBeenCalledWith("https://example.com/listing");
  });

  it("does not redirect visitors of a rejected event", async () => {
    const select = await renderLayoutFor({
      ...redirectingEvent,
      approval_status: "rejected",
    });

    expect(select.mock.calls[0]).toEqual([
      expect.stringContaining("approval_status"),
    ]);
    expect(redirect).not.toHaveBeenCalled();
  });
});
