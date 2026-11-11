import { render, screen } from "@testing-library/react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getEventForRoute } from "@/lib/events/server-event";
import { REQUEST_PATHNAME_HEADER } from "@/lib/events/navigation";
import Layout from "./layout";

jest.mock("next/headers", () => ({ headers: jest.fn() }));

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: jest.fn(),
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

// The layout resolves the event through the shared, request-cached lookup.
jest.mock("@/lib/events/server-event", () => ({
  getEventForRoute: jest.fn(),
}));

jest.mock("./RouteBasedLayoutConfig", () => ({
  RouteBasedLayoutConfig: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("./conditional-event-layout", () => ({
  ConditionalEventLayout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

function mockRequest(pathname: string | null, event: unknown = null) {
  (headers as jest.Mock).mockResolvedValue(
    new Headers(pathname ? { [REQUEST_PATHNAME_HEADER]: pathname } : {})
  );

  (getEventForRoute as jest.Mock).mockResolvedValue({ data: event });
}

function renderLayout(id: string) {
  return Layout({
    children: <p>page content</p>,
    params: Promise.resolve({ id }),
  });
}

describe("event layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["accept-judge", "accept-participant", "accept-organizer"])(
    "lets %s render its link-changed page for an unknown slug",
    async (route) => {
      mockRequest(`/events/old-slug/${route}`);

      render(await renderLayout("old-slug"));

      expect(screen.getByText("page content")).toBeInTheDocument();
      expect(notFound).not.toHaveBeenCalled();
    }
  );

  it.each(["/events/old-slug/overview", "/events/old-slug/accept", null])(
    "returns a 404 for an unknown slug on %s",
    async (pathname) => {
      mockRequest(pathname);

      await expect(renderLayout("old-slug")).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalledTimes(1);
    }
  );

  it("renders a known event without consulting the request path", async () => {
    mockRequest(null, {
      event_id: "event-123",
      slug: "hack-night",
      event_name: "Hack Night",
    });

    render(await renderLayout("hack-night"));

    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(headers).not.toHaveBeenCalled();
  });
});
