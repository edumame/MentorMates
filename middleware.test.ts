/** @jest-environment node */
import { NextRequest } from "next/server";
import { EVENT_REQUEST_PATHNAME_HEADER } from "@/lib/events/navigation";
import { middleware } from "./middleware";

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  })),
}));

const forwardedHeader = `x-middleware-request-${EVENT_REQUEST_PATHNAME_HEADER}`;

describe("middleware", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("forwards the request pathname to server components", async () => {
    const response = await middleware(
      new NextRequest("http://localhost:3000/events/demo/accept-judge?email=a")
    );

    expect(response.headers.get(forwardedHeader)).toBe(
      "/events/demo/accept-judge"
    );
  });

  it("overwrites a client-supplied pathname header", async () => {
    const response = await middleware(
      new NextRequest("http://localhost:3000/events/demo/overview", {
        headers: {
          [EVENT_REQUEST_PATHNAME_HEADER]: "/events/demo/accept-judge",
        },
      })
    );

    expect(response.headers.get(forwardedHeader)).toBe(
      "/events/demo/overview"
    );
  });
});
