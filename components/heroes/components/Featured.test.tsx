import React from "react";
import { render, screen } from "@testing-library/react";
import { Featured } from "./Featured";

function mockEvents(events: Record<string, unknown>[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ events }),
  }) as unknown as typeof fetch;
}

const baseEvent = {
  event_id: "event-1",
  event_name: "Boston Hack",
  slug: "boston-hack",
  event_blurb: "A weekend of building",
  event_date: "2026-12-01",
  featured: true,
};

describe("Featured", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows the event's real location", async () => {
    mockEvents([{ ...baseEvent, location: "Boston, MA" }]);

    render(<Featured />);

    expect(await screen.findByText("Boston, MA")).toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });

  it("shows Online when that is the stored location", async () => {
    mockEvents([{ ...baseEvent, location: "Online" }]);

    render(<Featured />);

    expect(await screen.findByText("Online")).toBeInTheDocument();
  });

  it.each([
    ["missing", {}],
    ["null", { location: null }],
    ["empty", { location: "" }],
    ["blank", { location: "   " }],
  ])("does not claim Online when location is %s", async (_label, location) => {
    mockEvents([{ ...baseEvent, ...location }]);

    render(<Featured />);

    expect(await screen.findByText("Boston Hack")).toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });

  it.each([
    ["null", null],
    ["empty", ""],
  ])(
    "falls back to the event description when the blurb is %s",
    async (_label, blurb) => {
      mockEvents([
        { ...baseEvent, event_blurb: blurb, event_description: "Real text" },
      ]);

      render(<Featured />);

      expect(await screen.findByText("Real text")).toBeInTheDocument();
    }
  );

  it("prefers the blurb over the description", async () => {
    mockEvents([{ ...baseEvent, event_description: "Long description" }]);

    render(<Featured />);

    expect(await screen.findByText("A weekend of building")).toBeInTheDocument();
    expect(screen.queryByText("Long description")).not.toBeInTheDocument();
  });
});
