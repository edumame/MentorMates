# Events Page Redesign + Public Organizer Submission

Tracking issue: [#766](https://github.com/edumame/MentorMates/issues/766)

## Reference

Cerebral Valley `/events` (May 2026) — discover/attended/hosting tabs, featured row, date-grouped feed, sticky calendar + filters, prominent "New Event" CTA.

## Phased delivery

### Phase 1 — Public submission gate (smallest unit, ships first)

- Add "Host an event" CTA on `/events` for any logged-in user
- Relax access on `app/events/new/page.tsx` — default to `approval_status = Pending`, `visibility = Public` for non-admin submitters
- Admin queue in `app/admin/page.tsx` to approve/reject
- Email submitter on approval/rejection via existing transactional infra

### Phase 2 — Discover redesign (UI only, no schema changes)

- Tabs: Discover / Attended / Hosting
- Date-grouped feed (Today / Tomorrow / This Week / Next Week / Later)
- Sticky right rail with calendar + location filter + event-type filter
- Featured row driven by `is_featured` flag (new column, see Phase 3)

### Phase 3 — Featured + verified

- Add `is_featured` boolean + admin toggle
- Add `organizer_verified` boolean + verified badge in card

## Files

| Area | Path |
| --- | --- |
| Server fetch + role gating | `app/events/page.tsx` |
| Client view | `components/eventsPageClient.tsx` |
| Submission wizard | `app/events/new/page.tsx` |
| Admin approval queue | `app/admin/page.tsx` |
| Types | `lib/types/index.ts` (or wherever `EventVisibility` lives) |
| Migration | `supabase/migrations/<new>_events_featured_verified.sql` |

## Open questions

- Does "Attended" mean RSVP'd, registered, or actually showed up (check-in)?
- Should event-type be a single tag or multi-tag? CV uses single.
- Is the existing `user_event_roles` table sufficient for "Hosting" filtering, or do we need a separate `submitted_by` column on `events`?
