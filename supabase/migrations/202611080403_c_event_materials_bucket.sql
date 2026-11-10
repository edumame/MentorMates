-- Lane C (audit 2026-11-08): ORG-022
--
-- The 'event-materials' bucket used for event cover images was never created
-- by a migration (only an INSERT policy existed that let any organizer of any
-- event write anywhere in it), so cover uploads failed with "Bucket not found"
-- on a freshly migrated database.
--
-- Layout:
--   event-covers/<event_id>/<file>  Edit Event (BasicInfoTab): managers of that event
--   event-covers/<file>             create-event wizard, before the event exists:
--                                   any signed-in user, own objects only
-- Bucket limits enforce 5MB and raster image types (no SVG).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-materials',
  'event-materials',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder name -> event id, or null when it is not a UUID.
create or replace function public.event_cover_event_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v_segment text := split_part(p_name, '/', 2);
begin
  if split_part(p_name, '/', 1) <> 'event-covers' or split_part(p_name, '/', 3) = '' then
    return null;
  end if;
  if v_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_segment::uuid;
  end if;
  return null;
end;
$$;

drop policy if exists "upload organizer 1201s55_0" on storage.objects;

drop policy if exists "Event managers can upload event covers" on storage.objects;
create policy "Event managers can upload event covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-materials'
    and (
      -- event folder: must manage that event
      public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
      -- wizard flat path: event-covers/<file> (no sub-folder)
      or (
        split_part(name, '/', 1) = 'event-covers'
        and split_part(name, '/', 2) <> ''
        and split_part(name, '/', 3) = ''
      )
    )
  );

drop policy if exists "Event managers can update event covers" on storage.objects;
create policy "Event managers can update event covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event-materials'
    and (
      owner_id = (select auth.uid())::text
      or public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'event-materials'
    and (
      owner_id = (select auth.uid())::text
      or public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
    )
  );

drop policy if exists "Event managers can delete event covers" on storage.objects;
create policy "Event managers can delete event covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-materials'
    and (
      owner_id = (select auth.uid())::text
      or public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
    )
  );
