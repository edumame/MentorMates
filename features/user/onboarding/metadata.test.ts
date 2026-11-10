import {
  getPostAuthRedirectPath,
  hasCompletedOnboarding,
  hasPersistedOnboardingState,
  ONBOARDING_SKIP_STATUS,
} from "./metadata";

describe("onboarding metadata helpers", () => {
  it("treats skipped onboarding as persisted but incomplete", () => {
    const metadata = {
      version: 4,
      status: ONBOARDING_SKIP_STATUS,
      skippedAt: "2026-04-03T12:00:00.000Z",
    };

    expect(hasPersistedOnboardingState(metadata)).toBe(true);
    expect(hasCompletedOnboarding(metadata)).toBe(false);
  });

  it("treats completed onboarding payloads as complete", () => {
    const metadata = {
      version: 3,
      completedAt: "2026-04-03T12:00:00.000Z",
      answers: {
        familiarity: "beginner",
      },
    };

    expect(hasPersistedOnboardingState(metadata)).toBe(true);
    expect(hasCompletedOnboarding(metadata)).toBe(true);
  });

  it("treats empty or missing metadata as incomplete", () => {
    expect(hasPersistedOnboardingState(null)).toBe(false);
    expect(hasPersistedOnboardingState({})).toBe(false);
    expect(hasCompletedOnboarding(null)).toBe(false);
    expect(hasCompletedOnboarding({})).toBe(false);
  });
});

describe("getPostAuthRedirectPath", () => {
  const skipped = { version: 4, status: ONBOARDING_SKIP_STATUS };

  it.each([[null], [undefined], [{}]])(
    "routes to onboarding with the return URL for metadata %j",
    (metadata) => {
      expect(getPostAuthRedirectPath(metadata, "/events/1?tab=a")).toBe(
        "/onboarding?returnUrl=%2Fevents%2F1%3Ftab%3Da"
      );
    }
  );

  it.each([["/"], [null], [undefined]])(
    "omits a trivial return URL (%j) from the onboarding link",
    (returnUrl) => {
      expect(getPostAuthRedirectPath(null, returnUrl)).toBe("/onboarding");
    }
  );

  it("goes to the return URL once onboarding state exists, even if skipped", () => {
    expect(getPostAuthRedirectPath(skipped, "/events/1")).toBe("/events/1");
    expect(getPostAuthRedirectPath(skipped, null)).toBe("/");
  });
});
