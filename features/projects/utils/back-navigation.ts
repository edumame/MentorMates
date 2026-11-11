/** null means preserve ordinary browser-back behavior; judges explicitly return to scoring's gallery. */
export function projectBackTarget(eventId: string | null | undefined, isJudge: boolean, hasHistory: boolean): string | null {
  if (eventId && isJudge) return `/events/${eventId}/gallery?view=judge`;
  if (hasHistory) return null;
  return eventId ? `/events/${eventId}/overview` : '/projects';
}
