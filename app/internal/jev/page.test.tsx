/** @jest-environment jsdom */
import JevPage from "./page";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/components/internal/jev-playground", () => ({
  JevPlayground: (props: { invite: string; label: string }) => <div data-testid="playground">{props.invite}|{props.label}</div>,
}));

import { render, screen } from "@testing-library/react";

const withInvite = (row: Record<string, unknown> | null) => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
});

describe("/internal/jev page", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404s when there is no invite in the link", async () => {
    await expect(JevPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s for a revoked invite", async () => {
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(
      withInvite({ id: "i", code: "x", service: "jev", revoked_at: "2026-09-18T00:00:00Z", expires_at: null, max_uses: null, uses: 0 })
    );
    await expect(JevPage({ searchParams: Promise.resolve({ invite: "x" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the playground for a live invite", async () => {
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(
      withInvite({ id: "i", code: "beta", service: "jev", label: "Aikagra", revoked_at: null, expires_at: null, max_uses: null, uses: 0 })
    );
    const ui = await JevPage({ searchParams: Promise.resolve({ invite: "beta" }) });
    render(ui);
    expect(screen.getByTestId("playground")).toHaveTextContent("beta|Aikagra");
  });
});
