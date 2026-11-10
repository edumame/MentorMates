/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/app/utils/supabase/middleware";
import { REQUEST_PATHNAME_HEADER } from "@/lib/events/navigation";
import { middleware } from "./middleware";

jest.mock("@/app/utils/supabase/middleware", () => ({
  updateSession: jest.fn(),
}));

describe("middleware", () => {
  it("tells server components which path was requested", async () => {
    (updateSession as jest.Mock).mockResolvedValue(NextResponse.next());

    await middleware(
      new NextRequest(
        "https://mentormates.ai/events/old-slug/accept-judge?email=a%40b.co",
        // A client-supplied value must not survive.
        { headers: { [REQUEST_PATHNAME_HEADER]: "/spoofed" } }
      )
    );

    const forwarded = (updateSession as jest.Mock).mock.calls[0][0] as NextRequest;
    expect(forwarded.headers.get(REQUEST_PATHNAME_HEADER)).toBe(
      "/events/old-slug/accept-judge"
    );
  });
});
