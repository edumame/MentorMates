import { render, screen } from "@testing-library/react";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { FeedContent } from "./feed-content";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const feedRow = {
  id: "feed-1",
  content: "Shipped it",
  created_at: "2026-01-01T00:00:00Z",
  type: "update",
  display_name: null,
  user_id: "author-1",
};

function viewerQuery(table: string) {
  const query = {
    select: () => query,
    eq: () => query,
    // RLS returns no profile rows to this viewer.
    in: async () => ({ data: [], error: null }),
    order: async () => ({
      data: table === "platform_engagement" ? [feedRow] : [],
      error: null,
    }),
  };
  return query;
}

describe("FeedContent", () => {
  it("names authors whose profiles RLS hides from the viewer", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({ from: viewerQuery });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          in: async () => ({
            data: [{ uid: "author-1", display_name: "Ada Author" }],
            error: null,
          }),
        }),
      }),
    });

    render(await FeedContent({ eventId: "e", slug: "s", currentPage: 1 }));

    expect(screen.getByText("Ada Author")).toBeInTheDocument();
    expect(screen.queryByText("Anonymous User")).toBeNull();
  });
});
