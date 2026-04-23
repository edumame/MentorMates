export const ONBOARDING_SKIP_STATUS = "skipped" as const;

type OnboardingMetadata = Record<string, unknown> | null | undefined;

function isRecord(
  metadata: OnboardingMetadata
): metadata is Record<string, unknown> {
  return typeof metadata === "object" && metadata !== null;
}

export function hasPersistedOnboardingState(
  metadata: OnboardingMetadata
): metadata is Record<string, unknown> {
  return isRecord(metadata) && Object.keys(metadata).length > 0;
}

export function hasCompletedOnboarding(metadata: OnboardingMetadata): boolean {
  if (!hasPersistedOnboardingState(metadata)) {
    return false;
  }

  if (metadata.status === ONBOARDING_SKIP_STATUS) {
    return false;
  }

  return typeof metadata.completedAt === "string";
}
