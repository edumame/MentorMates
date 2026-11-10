/**
 * Helpers for judge/mentor auto-assignment in the Assign Roles tab
 * (JUDGE-008). The assignment itself runs in the database
 * (public.auto_assign_event_roles).
 */

/** Clamps a per-project count to 1..poolSize (1 when the pool is empty). */
export function clampPerProject(value: number, poolSize: number): number {
  const max = Math.max(1, poolSize);
  if (!Number.isFinite(value)) return Math.min(3, max);
  return Math.min(max, Math.max(1, Math.trunc(value)));
}
