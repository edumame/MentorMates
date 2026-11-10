-- MENT-003 / MENT-004 / MENT-005: mentor booking integrity.
-- mentor_availability is writable by mentors straight through PostgREST
-- (policy "Mentor manages own availability"), so the API checks alone are
-- bypassable; the slot rules live in a trigger here.
--
-- A trigger (not an EXCLUDE constraint) is used for overlaps because existing
-- installations already contain overlapping rows, which would make a
-- constraint fail to apply; the trigger only guards new/changed rows.

create or replace function public.mentor_availability_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Serialise slot writes per mentor+event so two concurrent inserts can't
  -- both pass the overlap check.
  perform pg_advisory_xact_lock(
    hashtextextended('mentor_availability:' || new.mentor_id::text || ':' || new.event_id::text, 0)
  );

  if tg_op = 'INSERT' and new.end_time <= now() then
    raise exception 'Availability must end in the future' using errcode = '23514';
  end if;

  if new.end_time - new.start_time > interval '8 hours' then
    raise exception 'Availability slots can be at most 8 hours long' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.mentor_availability other
    where other.mentor_id = new.mentor_id
      and other.event_id = new.event_id
      and other.id <> new.id
      and tstzrange(other.start_time, other.end_time) && tstzrange(new.start_time, new.end_time)
  ) then
    raise exception 'This overlaps one of your existing availability slots' using errcode = '23P01';
  end if;

  return new;
end
$$;

drop trigger if exists mentor_availability_guard on public.mentor_availability;
create trigger mentor_availability_guard
  before insert or update of start_time, end_time, mentor_id, event_id
  on public.mentor_availability
  for each row execute function public.mentor_availability_guard();

-- Booking: only participants consume capacity, and a participant can't hold
-- two confirmed sessions at overlapping times.
create or replace function public.book_mentor_slot(p_event_id uuid, p_availability_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  slot public.mentor_availability;
  booking public.mentor_bookings;
  active_count integer;
begin
  if actor is null or not exists (
    select 1 from public.user_event_roles where event_id = p_event_id and user_id = actor
  ) then
    raise exception 'Event membership required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_event_roles
    where event_id = p_event_id and user_id = actor and role = 'participant'
  ) then
    raise exception 'Only participants can book mentor sessions' using errcode = '42501';
  end if;

  select * into slot from public.mentor_availability
  where id = p_availability_id and event_id = p_event_id
  for update;
  if not found then
    raise exception 'Slot not found' using errcode = 'P0002';
  end if;
  if slot.mentor_id = actor then
    raise exception 'Mentors cannot book their own slot' using errcode = '22023';
  end if;
  if slot.end_time <= clock_timestamp() then
    raise exception 'This slot has ended' using errcode = '23514';
  end if;

  select * into booking from public.mentor_bookings
  where availability_id = slot.id and participant_id = actor;
  if found and booking.status = 'confirmed' then
    return to_jsonb(booking);
  end if;

  -- Serialise this participant's bookings so concurrent requests for two
  -- overlapping slots can't both pass the overlap check.
  perform pg_advisory_xact_lock(hashtextextended('mentor_booking:' || actor::text, 0));

  if exists (
    select 1
    from public.mentor_bookings b
    join public.mentor_availability a on a.id = b.availability_id
    where b.participant_id = actor
      and b.status = 'confirmed'
      and a.id <> slot.id
      and tstzrange(a.start_time, a.end_time) && tstzrange(slot.start_time, slot.end_time)
  ) then
    raise exception 'You already have a mentor session at this time' using errcode = '23514';
  end if;

  select count(*) into active_count from public.mentor_bookings
  where availability_id = slot.id and status = 'confirmed';
  if active_count >= slot.max_bookings then
    raise exception 'Slot is fully booked' using errcode = '23514';
  end if;

  insert into public.mentor_bookings(availability_id, participant_id, status)
  values (slot.id, actor, 'confirmed')
  on conflict (availability_id, participant_id)
  do update set status = 'confirmed', booked_at = now()
  returning * into booking;
  return to_jsonb(booking);
end
$$;

revoke all on function public.book_mentor_slot(uuid, uuid) from public, anon;
grant execute on function public.book_mentor_slot(uuid, uuid) to authenticated;
