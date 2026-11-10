-- A2 / MENT-008: user_profiles.email must mirror the verified auth.users email.
--
-- Before this migration any signed-in user could PATCH their own
-- user_profiles.email (and stripe_customer_id / uid / created_at) through
-- PostgREST. Invitation and role-grant code resolves invitees by
-- user_profiles.email, so rewriting it let a user receive judge/organizer roles
-- meant for someone else. The sign-up trigger also reassigned an existing
-- profile row to the new auth user on an email conflict, which made a squatted
-- email collide with the real person's account.

-- PROD PRE-CHECKS (read-only; run before applying and record the results):
--   -- profiles whose email differs from the verified auth email (rows step 2 changes)
--   select count(*) from public.user_profiles p join auth.users u on u.id = p.uid
--    where nullif(btrim(u.email), '') is not null
--      and p.email is distinct from lower(btrim(u.email));
--   -- profiles whose auth user has no email (left untouched by step 2)
--   select count(*) from public.user_profiles p join auth.users u on u.id = p.uid
--    where nullif(btrim(u.email), '') is null;
--   -- columns present on prod (step 1 warns about any not listed below)
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'user_profiles' order by 1;
--   -- current client privileges
--   select grantee, privilege_type, column_name from information_schema.column_privileges
--    where table_schema = 'public' and table_name = 'user_profiles'
--      and grantee in ('anon', 'authenticated') order by 1, 2, 3;

-- Quarantine schema for rows changed by A2 data fixes. Not exposed through
-- PostgREST and not readable by clients; drop after the owner has reviewed.
create schema if not exists audit_backup;
revoke all on schema audit_backup from public, anon, authenticated;

-- 1. Column-level privileges: clients may only write presentation fields.
--    Server-managed (never client-writable): uid (after insert), email,
--    created_at (after insert), stripe_customer_id, pulse.
--    A table-level grant overrides column revokes, so the table-level grant is
--    removed and the intended columns are granted explicitly:
--      INSERT: uid, email*, display_name, created_at, bio, links, affiliation,
--              avatar_url, avatar, onboarding_metadata   (*email is overwritten
--              by the trigger below with the auth email)
--      UPDATE: display_name, bio, links, affiliation, avatar_url, avatar,
--              onboarding_metadata
--    anon gets no write privileges (it has no profile).
--    Any column that exists only on prod is not silently dropped: it is
--    reported with a WARNING and keeps client write access (previous
--    behaviour) until reviewed.
revoke insert, update on public.user_profiles from anon, authenticated;

grant insert (uid, email, display_name, created_at, bio, links, affiliation,
              avatar_url, avatar, onboarding_metadata)
  on public.user_profiles to authenticated;

grant update (display_name, bio, links, affiliation, avatar_url, avatar,
              onboarding_metadata)
  on public.user_profiles to authenticated;

do $$
declare
  v_col text;
begin
  for v_col in
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'user_profiles'
       and column_name not in (
         'uid', 'email', 'display_name', 'created_at', 'bio', 'links', 'affiliation',
         'avatar_url', 'avatar', 'onboarding_metadata', 'stripe_customer_id', 'pulse'
       )
  loop
    raise warning 'user_profiles.% is not in the A2 column list; keeping client insert/update on it - review', v_col;
    execute format('grant insert (%I), update (%I) on public.user_profiles to authenticated', v_col, v_col);
  end loop;
end $$;

-- 2. Heal existing rows: a profile whose email differs from its auth user's
--    (non-empty) email is reset to the auth email. Old values are copied to
--    audit_backup first. Profiles whose auth user has no email are NOT
--    touched (their stored email is kept and can no longer be changed by the
--    user; see fixes/A2.json for the open decision). Emails are cleared first
--    so a squatted address can move back to its real owner without a unique
--    violation; a row whose auth email is still held by another profile stays
--    NULL and is listed in the backup.
create table if not exists audit_backup.user_profiles_email_20261108 (
  uid uuid primary key,
  old_email text,
  auth_email text,
  captured_at timestamptz not null default now()
);
revoke all on audit_backup.user_profiles_email_20261108 from public, anon, authenticated;

insert into audit_backup.user_profiles_email_20261108 (uid, old_email, auth_email)
select p.uid, p.email, lower(btrim(u.email))
  from public.user_profiles p
  join auth.users u on u.id = p.uid
 where nullif(btrim(u.email), '') is not null
   and p.email is distinct from lower(btrim(u.email))
on conflict (uid) do nothing;

do $$
declare v_count integer;
begin
  select count(*) into v_count
    from public.user_profiles p join auth.users u on u.id = p.uid
   where nullif(btrim(u.email), '') is not null
     and p.email is distinct from lower(btrim(u.email));
  raise notice 'A2 MENT-008: % profile email(s) differ from auth email and will be reset (backed up in audit_backup.user_profiles_email_20261108)', v_count;
end $$;

update public.user_profiles p
   set email = null
  from auth.users u
 where u.id = p.uid
   and nullif(btrim(u.email), '') is not null
   and p.email is distinct from lower(btrim(u.email));

update public.user_profiles p
   set email = lower(btrim(u.email))
  from auth.users u
 where u.id = p.uid
   and p.email is null
   and nullif(btrim(u.email), '') is not null
   and not exists (
     select 1 from public.user_profiles o
      where o.email = lower(btrim(u.email))
   );

-- 3. Defense in depth for requests made with a user JWT (anon/authenticated):
--    the email always comes from auth.users and server-managed columns cannot
--    change, even if a future grant is widened by mistake. Service-role and
--    direct database sessions (migrations, auth triggers) are trusted.
create or replace function public.enforce_user_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_email text;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  select lower(btrim(u.email)) into v_auth_email
    from auth.users u
   where u.id = coalesce(new.uid, old.uid);

  if tg_op = 'INSERT' then
    new.email := v_auth_email;
    new.stripe_customer_id := null;
  else
    new.uid := old.uid;
    new.created_at := old.created_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.email := coalesce(v_auth_email, old.email);
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_user_profile_identity() from public, anon, authenticated;

drop trigger if exists enforce_user_profile_identity on public.user_profiles;
create trigger enforce_user_profile_identity
  before insert or update on public.user_profiles
  for each row execute function public.enforce_user_profile_identity();

-- 4. Sign-up trigger: never reassign an existing profile row to a different
--    auth user. A stale row that still holds this email (left over from before
--    this migration) is evicted from the email instead, so the verified owner
--    of the address keeps working sign-ups.
create or replace function public.release_squatted_profile_email(p_uid uuid, p_email text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.user_profiles p
     set email = null
   where p.email = p_email
     and p.uid <> p_uid
     and not exists (
       select 1 from auth.users u
        where u.id = p.uid and lower(btrim(u.email)) = p_email
     );
$$;

revoke all on function public.release_squatted_profile_email(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
  v_normalized_email text;
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.confirmed_at is null then
      return new;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.confirmed_at is not null or new.confirmed_at is null then
      return new;
    end if;
  else
    return new;
  end if;

  v_normalized_email := lower(btrim(new.email));

  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(v_normalized_email, '@', 1)
  );

  perform public.release_squatted_profile_email(new.id, v_normalized_email);

  insert into public.user_profiles (uid, email, display_name, created_at)
  values (new.id, v_normalized_email, v_display_name, coalesce(new.created_at, now()))
  on conflict (uid) do update
    set email = excluded.email,
        display_name = coalesce(public.user_profiles.display_name, excluded.display_name);

  return new;
end;
$$;

-- 5. Keep the mirror in sync when a user changes their auth email.
create or replace function public.sync_user_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normalized_email text;
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;
  v_normalized_email := lower(btrim(new.email));

  perform public.release_squatted_profile_email(new.id, v_normalized_email);

  update public.user_profiles
     set email = v_normalized_email
   where uid = new.id
     and email is distinct from v_normalized_email;

  return new;
end;
$$;

revoke all on function public.sync_user_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed_profile on auth.users;
create trigger on_auth_user_email_changed_profile
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_user_profile_email();
