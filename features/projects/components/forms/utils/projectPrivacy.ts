export function getProjectVisibilityDescription(isPrivate: boolean) {
  return isPrivate
    ? "Your project is now private to your event."
    : "Your project is now public.";
}
