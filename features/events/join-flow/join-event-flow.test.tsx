import { render, waitFor } from "@testing-library/react";
import { EventRole, type PricingTier } from "@/lib/types";
import { getPaidJoinNextStep } from "./join-event-next-step";
import {
  createJoinEventIntent,
  JOIN_EVENT_INTENT_STORAGE_KEY,
  parseJoinEventIntent,
  writeJoinEventIntent,
} from "./join-event-intent";
import { useResumeJoinEventIntent } from "./use-resume-join-event-intent";
import {
  addJoinEventFlowQuery,
  hasJoinEventFlowQuery,
  removeJoinEventFlowQuery,
} from "./join-event-url";

function tier(overrides: Partial<PricingTier> = {}): PricingTier {
  return {
    id: "tier-1",
    event_id: "event-1",
    tier_id: "regular",
    name: "Regular",
    price: 1000,
    ...overrides,
  };
}

function ResumeHarness({
  enabled,
  onResume,
}: {
  enabled: boolean;
  onResume: Parameters<typeof useResumeJoinEventIntent>[0]["onResume"];
}) {
  useResumeJoinEventIntent({
    eventId: "event-1",
    enabled,
    onResume,
  });

  return null;
}

describe("join event flow helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens tier selection for a single available pricing tier", () => {
    expect(getPaidJoinNextStep([tier()])).toEqual({
      type: "select_pricing",
      defaultPricingTierId: "tier-1",
    });
  });

  it("opens tier selection for multiple available pricing tiers", () => {
    expect(
      getPaidJoinNextStep([
        tier({ id: "tier-1" }),
        tier({ id: "tier-2", tier_id: "vip", price: 2500 }),
      ])
    ).toEqual({
      type: "select_pricing",
      defaultPricingTierId: "tier-1",
    });
  });

  it("preselects a stored preferred pricing tier when it is available", () => {
    expect(
      getPaidJoinNextStep(
        [
          tier({ id: "tier-1" }),
          tier({ id: "tier-2", tier_id: "vip", price: 2500 }),
        ],
        "tier-2"
      )
    ).toEqual({
      type: "select_pricing",
      defaultPricingTierId: "tier-2",
    });
  });

  it("parses typed join intents and rejects malformed values", () => {
    const intent = createJoinEventIntent({
      eventId: "event-1",
      role: EventRole.Participant,
      pricingTierId: "tier-1",
    });

    expect(parseJoinEventIntent(JSON.stringify(intent))).toMatchObject({
      type: "event_join",
      eventId: "event-1",
      role: EventRole.Participant,
      pricingTierId: "tier-1",
    });
    expect(parseJoinEventIntent(JSON.stringify({ eventId: "event-1" }))).toBeNull();
    expect(parseJoinEventIntent("not-json")).toBeNull();
  });

  it("resumes a matching stored join intent once enabled", async () => {
    const onResume = jest.fn();
    writeJoinEventIntent(
      createJoinEventIntent({
        eventId: "event-1",
        role: EventRole.Participant,
      })
    );

    const { rerender } = render(
      <ResumeHarness enabled={false} onResume={onResume} />
    );
    expect(onResume).not.toHaveBeenCalled();

    rerender(<ResumeHarness enabled={true} onResume={onResume} />);

    await waitFor(() => {
      expect(onResume).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-1",
          role: EventRole.Participant,
        })
      );
    });

    rerender(<ResumeHarness enabled={true} onResume={onResume} />);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("ignores stored intents for other events", () => {
    const onResume = jest.fn();
    localStorage.setItem(
      JOIN_EVENT_INTENT_STORAGE_KEY,
      JSON.stringify(
        createJoinEventIntent({
          eventId: "event-2",
          role: EventRole.Participant,
        })
      )
    );

    render(<ResumeHarness enabled={true} onResume={onResume} />);

    expect(onResume).not.toHaveBeenCalled();
  });

  it("adds and removes the join event flow query while preserving the path", () => {
    const path = "/events/public-demo?ref=feed#details";

    const withJoinFlowQuery = addJoinEventFlowQuery(path);

    expect(withJoinFlowQuery).toBe(
      "/events/public-demo?ref=feed&joinEventFlow=resume#details"
    );
    expect(hasJoinEventFlowQuery("?ref=feed&joinEventFlow=resume")).toBe(true);
    expect(removeJoinEventFlowQuery(withJoinFlowQuery)).toBe(
      "/events/public-demo?ref=feed#details"
    );
  });

  it("rejects non-local join event flow return paths", () => {
    expect(addJoinEventFlowQuery("https://example.com/events/1")).toBeNull();
    expect(removeJoinEventFlowQuery("https://example.com/events/1")).toBeNull();
  });
});
