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

/**
 * Where to send a user who just authenticated: onboarding until any onboarding
 * state is persisted (a skip counts), then the return URL. Shared by every
 * sign-in path so they cannot drift.
 */
export function getPostAuthRedirectPath(
  metadata: OnboardingMetadata,
  returnUrl: string | null | undefined
): string {
  const target = returnUrl || "/";
  if (hasPersistedOnboardingState(metadata)) {
    return target;
  }

  return target === "/"
    ? "/onboarding"
    : `/onboarding?${new URLSearchParams({ returnUrl: target })}`;
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
