const HAS_OFFSET = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

/**
 * Parses a database timestamp as UTC. `timestamp without time zone` columns
 * (feedback/projects.created_at before migration 202611080503) come back from
 * PostgREST without an offset, and `new Date()` would read them as the
 * viewer's local time. Values that already carry an offset are unchanged.
 */
export function parseUtcTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const isoLike = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const date = new Date(HAS_OFFSET.test(isoLike) ? isoLike : `${isoLike}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
