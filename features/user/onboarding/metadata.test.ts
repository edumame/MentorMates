import {
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
