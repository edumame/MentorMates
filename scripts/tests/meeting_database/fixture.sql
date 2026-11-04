-- Synthetic reduced dependency fixture. NOT a production schema snapshot.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
CREATE TYPE public.event_role AS ENUM ('participant','mentor','judge','organizer','admin');
CREATE TYPE public.meeting_status AS ENUM ('upcoming','active','processing','completed','cancelled');
CREATE TABLE public.user_profiles(uid uuid PRIMARY KEY,email text);
CREATE TABLE public.events(event_id uuid PRIMARY KEY,owner_id uuid,session_caps jsonb);
CREATE TABLE public.user_event_roles(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 user_id uuid REFERENCES public.user_profiles(uid),event_id uuid REFERENCES public.events(event_id),
 role public.event_role,UNIQUE(user_id,event_id));
CREATE TABLE public.projects(id uuid PRIMARY KEY,event_id uuid,private boolean NOT NULL DEFAULT false,
 lead_email text,teammates text[]);
CREATE FUNCTION public.is_admin_user(user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT user_id='00000000-0000-4000-8000-000000000009'::uuid
$$;
CREATE FUNCTION public.user_has_event_role(p_event_id uuid,p_user_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_event_roles WHERE event_id=p_event_id AND user_id=p_user_id)
$$;
CREATE FUNCTION public.is_event_organizer(p_event_id uuid,p_user_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_event_roles WHERE event_id=p_event_id AND user_id=p_user_id AND role='organizer')
$$;
-- Real agents/meetings/project RLS migrations are loaded by harness next.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
GRANT SELECT ON public.events,public.user_event_roles TO authenticated;
GRANT INSERT,UPDATE,SELECT ON public.user_event_roles TO service_role;
