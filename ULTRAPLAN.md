# ULTRAPLAN — Issue #706: Multi-Round Judging

Branch: `feat/706-multi-round-judging`

## Goal
Allow organizers to configure N rounds per event. Top-K projects advance between rounds. Judges only see projects in the current/active round. Scores are segregated by `round_number` in leaderboard and CSV export. Events with no explicit rounds config behave as single-round (round 1, all projects) — full backward compatibility.

## Schema Changes

### `project_scores`
- Add `round_number INT NOT NULL DEFAULT 1`.
- Backfill all existing rows to `1`.
- Update `UNIQUE(project_id, judge_id)` → `UNIQUE(project_id, judge_id, round_number)` so a judge can re-score across rounds.
- Add index on `(event_id, round_number)`.

### `events.scoring_config`
Extend JSON shape with optional `rounds` array:
```json
{
  "tracks": { ... },
  "activeRound": 1,
  "rounds": [
    { "round_number": 1, "name": "Initial Judging", "advancement_count": 10 },
    { "round_number": 2, "name": "Finals", "advancement_count": null }
  ]
}
```
When `rounds` is absent → treat as single round (round 1, all event projects).

### New Table: `project_round_advancements`
Tracks which projects are in which round (round 1 advancements = all event projects by default; round N+1 = top-K of round N).
```sql
CREATE TABLE project_round_advancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  advanced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, project_id, round_number)
);
```
RLS: judges+organizers can SELECT; organizers can INSERT/DELETE.

## Backend

### `lib/judging/rounds.ts` helpers
- `getActiveRound(event)` → reads `scoring_config.activeRound` (default 1).
- `getRoundsConfig(event)` → returns normalized rounds array.
- `getProjectsForRound(supabase, eventId, roundNumber)` → if round 1 and no advancement rows, return all event projects; else return advancement rows joined to projects.
- `computeAdvancements(supabase, eventId, fromRound)` → computes avg score per project in round `fromRound`, picks top-K by `advancement_count`, inserts rows into `project_round_advancements` at `round=fromRound+1`.

### API: `POST /api/events/[eventId]/rounds/advance`
Body: `{ fromRound: number }`. Organizer-only. Calls `computeAdvancements`.

### Judging fetch filter
Patch judge project endpoints to intersect projects with `getProjectsForRound(event, activeRound)`.

### Score writes
When scores are saved, include `round_number = activeRound(event)`.

## Frontend

### Organizer UI
Add a simple rounds editor (extend TrackEditor or new `RoundsEditor`): add/remove rounds, set `name` + `advancement_count`, set active round, "Advance to next round" button (calls advance API).

### Leaderboard / CSV export
In scores/export panel, group scores by `round_number`, add "Round" column to CSV, and show per-round tables.

## Backward Compat
- No `rounds` in config → single round. Existing UI unchanged; existing scores all at round 1; advancement table empty resolves as "all event projects".
- Existing `project_scores` rows get `round_number = 1` via backfill.

## Verification
- `npm run build` / typecheck clean.
- Existing single-round flows unaffected.

## Files to Change
- `supabase/migrations/<ts>_multi_round_judging.sql` (new)
- `lib/types/index.ts` — extend `EventScoringConfig`, add `RoundConfig`, `ProjectRoundAdvancement`.
- `lib/database.types.ts` — add `project_round_advancements`, add `round_number` to `project_scores`.
- `lib/judging/rounds.ts` (new)
- `app/api/events/[eventId]/rounds/advance/route.ts` (new)
- `app/api/agent/events/projects/route.ts` — filter by round.
- `components/project-scoring/project-scoring-form.tsx` — include round_number on insert.
- Leaderboard / CSV export component — per-round grouping + CSV column.
- Rounds organizer UI (new `RoundsEditor.tsx`).
