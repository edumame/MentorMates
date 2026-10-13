/**
 * Pure helpers for computing the effective submission cutoff, given an
 * event's `submission_time_cutoff` and a configurable late-buffer (minutes).
 *
 * Design rules (see GitHub issue #777):
 *   - `buffer = 0` preserves the legacy hard-cutoff behavior.
 *   - Negative buffers are clamped to 0 (treated as no buffer).
 *   - Null cutoff means there is no deadline; `isLateSubmission` and
 *     `isWithinLateBuffer` must return `false` in that case.
 *   - `is_late` is purely a read-time derivation; we never persist it.
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeBuffer(bufferMinutes: number | null | undefined): number {
  if (typeof bufferMinutes !== "number" || !Number.isFinite(bufferMinutes)) {
    return 0;
  }
  return Math.max(0, Math.floor(bufferMinutes));
}

/**
 * Returns the effective cutoff (cutoff + buffer minutes). If cutoff is null,
 * returns null.
 */
export function computeEffectiveCutoff(
  cutoff: string | Date | null,
  bufferMinutes: number | null,
): Date | null {
  const cutoffDate = toDate(cutoff);
  if (!cutoffDate) return null;
  const buffer = normalizeBuffer(bufferMinutes);
  if (buffer === 0) return cutoffDate;
  return new Date(cutoffDate.getTime() + buffer * 60 * 1000);
}

/**
 * Returns true when a project's submitted_at is strictly after the event's
 * cutoff (i.e. the submission landed inside or beyond the buffer window).
 * Returns false when submitted_at or cutoff is null.
 */
export function isLateSubmission(
  submittedAt: string | Date | null,
  cutoff: string | Date | null,
): boolean {
  const submitted = toDate(submittedAt);
  const cutoffDate = toDate(cutoff);
  if (!submitted || !cutoffDate) return false;
  return submitted.getTime() > cutoffDate.getTime();
}

/**
 * Returns true when `now` is past the cutoff but still within the buffer
 * window (i.e. submissions are accepted but will be flagged as late).
 *
 * Returns false when:
 *   - cutoff is null
 *   - now is at or before cutoff (not late yet)
 *   - now is past cutoff + buffer (hard rejection territory)
 */
export function isWithinLateBuffer(
  now: Date,
  cutoff: string | Date | null,
  bufferMinutes: number | null,
): boolean {
  const cutoffDate = toDate(cutoff);
  if (!cutoffDate) return false;
  const buffer = normalizeBuffer(bufferMinutes);
  if (buffer === 0) return false;
  const effective = new Date(cutoffDate.getTime() + buffer * 60 * 1000);
  return now.getTime() > cutoffDate.getTime() && now.getTime() <= effective.getTime();
}
