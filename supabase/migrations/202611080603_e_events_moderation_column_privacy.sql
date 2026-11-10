-- XL-014 (lane E): signed-in users kept column SELECT on
-- events.rejection_reason (the moderator's note) and on the legacy
-- submitter_* / organizer_affiliation / expected_attendance columns (always
-- null since B 0301, but still part of the API surface). Any signed-in user
-- who could see a rejected-but-visible event could read the reason.
--
-- Revoke them from `authenticated` (anon already lacks them, B 0302). The
-- people who need the reason - admins, the event owner and its organizers -
-- read it through get_event_rejection_reasons() (app/admin/page.tsx).
-- Submitter contact details stay in the admin-only public.event_submissions.
--
-- Must run after 202611080302 (which grants the column list).
-- Deploy: see audit-2026-11-08/final/DEPLOY-CHECKLIST.md. Idempotent.

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'events'
    and column_name in ('rejection_reason', 'submitter_email', 'submitter_name',
                        'organizer_affiliation', 'expected_attendance');
  if cols is not null then
    execute format('revoke select (%s) on public.events from authenticated', cols);
  end if;
end;
$$;

create or replace function public.get_event_rejection_reasons(p_event_ids uuid[])
returns table (event_id uuid, rejection_reason text)
language sql
stable
security definer
set search_path = public
as $$
  select e.event_id, e.rejection_reason
  from public.events e
  where e.event_id = any (p_event_ids)
    and e.rejection_reason is not null
    and public.can_manage_event(e.event_id, (select auth.uid()));
$$;

revoke all on function public.get_event_rejection_reasons(uuid[]) from public, anon;
grant execute on function public.get_event_rejection_reasons(uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
