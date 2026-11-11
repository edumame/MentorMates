/**
 * prizes -> event_tracks is a to-one embed, so PostgREST returns an object.
 * Queries without overrideTypes are inferred as an array and need a cast.
 */
export type PrizeWithEvent = {
  event_tracks?: { event_id: string | null } | null;
};

/**
 * A prize only counts for the event it was awarded in. Rows in prize_winners
 * key on project_id alone, so a project that later changed event would
 * otherwise carry the prize along. Unknown events never match, so a row whose
 * event cannot be resolved is not shown as a win. RLS hides event_tracks from
 * anonymous callers unless the event is public or private, so an anonymous read
 * that is not limited to public events must embed it through the service client.
 */
export function isPrizeFromEvent(
  prize: PrizeWithEvent | null | undefined,
  eventId: string | null | undefined,
): boolean {
  return Boolean(eventId) && prize?.event_tracks?.event_id === eventId;
}
