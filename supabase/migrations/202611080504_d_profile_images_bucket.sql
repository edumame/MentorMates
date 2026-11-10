-- MENT-010: avatar uploads go to the 'profile-images' bucket, which no
-- migration created (uploads failed with "Bucket not found" on a migrated DB)
-- and nothing versioned restricted type, size or path.
--
-- Layout: avatars/<auth.uid()>-<timestamp>.<ext>, public read (avatars are
-- shown on public pages). Writes are limited to the caller's own prefix.
-- Bucket limits: 5MB, raster image types only (no SVG).
-- If production already has this bucket, this aligns its limits/policies.
--
-- PROD PRE-CHECK (read-only): existing bucket config and every storage
-- policy that mentions the bucket. Pre-existing permissive policies would be
-- OR-ed with ours; 202611080505 drops all of them and recreates only these.
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'profile-images';
--   select policyname, cmd, roles, qual, with_check from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and coalesce(qual,'') || coalesce(with_check,'') like '%profile-images%';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own profile images" on storage.objects;
create policy "Users upload own profile images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  );

drop policy if exists "Users update own profile images" on storage.objects;
create policy "Users update own profile images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  )
  with check (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  );

drop policy if exists "Users delete own profile images" on storage.objects;
create policy "Users delete own profile images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  );
