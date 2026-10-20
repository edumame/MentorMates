-- Stage 2: restrictive boundary. Apply ONLY after the stage-1 application consumer is live.
-- Do not apply both stages blindly via db push; see docs/security/meeting-database-rollout.md.
BEGIN;
-- Unexpected policies need review: permissive policies OR together.
DO $$
DECLARE unexpected text;
BEGIN
 IF to_regprocedure('public.meeting_associations_allowed(uuid,uuid,uuid)') IS NULL THEN
   RAISE EXCEPTION 'Apply the additive meeting timeline migration and deploy its consumer before this restrictive migration';
 END IF;
 SELECT string_agg(policyname, ', ') INTO unexpected FROM pg_policies
 WHERE schemaname='public' AND tablename='meetings' AND policyname NOT IN (
   'Enable delete for users based on user_id','Enable insert for authenticated users only',
   'Enable insert for users based on user_id','Enable read access for all users',
   'Users can update own meetings','meetings_read_authorized','meetings_insert_owner',
   'meetings_update_owner','meetings_delete_owner');
 IF unexpected IS NOT NULL THEN RAISE EXCEPTION 'Unexpected meetings policies: %',unexpected; END IF;
END $$;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.meetings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.meetings;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.meetings;
DROP POLICY IF EXISTS "Users can update own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.meetings;
DROP POLICY IF EXISTS meetings_read_authorized ON public.meetings;
DROP POLICY IF EXISTS meetings_insert_owner ON public.meetings;
DROP POLICY IF EXISTS meetings_update_owner ON public.meetings;
DROP POLICY IF EXISTS meetings_delete_owner ON public.meetings;
CREATE POLICY meetings_read_authorized ON public.meetings FOR SELECT TO authenticated
 USING (public.meeting_full_access(user_id,event_id));
CREATE POLICY meetings_insert_owner ON public.meetings FOR INSERT TO authenticated
 WITH CHECK (user_id = auth.uid());
CREATE POLICY meetings_update_owner ON public.meetings FOR UPDATE TO authenticated
 USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY meetings_delete_owner ON public.meetings FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.meetings FROM PUBLIC, anon, authenticated;
-- Existing column ACLs survive table REVOKE, so clear them explicitly as well.
DO $$
DECLARE cols text;
BEGIN
 SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
 WHERE attrelid='public.meetings'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.meetings FROM PUBLIC, anon, authenticated',cols,cols,cols,cols);
END $$;
GRANT SELECT, DELETE ON public.meetings TO authenticated;
GRANT INSERT(name,user_id,agent_id,event_id,project_id) ON public.meetings TO authenticated;
GRANT UPDATE(name,agent_id,event_id,project_id) ON public.meetings TO authenticated;

-- Association helper is defined once in the additive stage-1 migration.
-- Invoker trigger: current_user retains database role; existing trusted server and
-- postgres-owned auto-conversation functions remain able to write managed fields.
CREATE OR REPLACE FUNCTION public.validate_meeting_client_associations()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.agent_id IS NOT DISTINCT FROM OLD.agent_id AND
      NEW.event_id IS NOT DISTINCT FROM OLD.event_id AND
      NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN RETURN NEW; END IF;
 END IF;
 IF NOT public.meeting_associations_allowed(NEW.agent_id,NEW.event_id,NEW.project_id) THEN
   RAISE EXCEPTION 'Invalid meeting association' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_meeting_client_associations() FROM PUBLIC,anon;
DROP TRIGGER IF EXISTS validate_meeting_client_associations ON public.meetings;
CREATE TRIGGER validate_meeting_client_associations BEFORE INSERT OR UPDATE ON public.meetings
 FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_client_associations();
-- Historical SECURITY DEFINER entry point inserts arbitrary caller-specified
-- owners/event associations under its postgres owner. It must be trigger/server-only.
DO $$
BEGIN
 IF to_regprocedure('public.create_auto_conversations_for_event_role(uuid,uuid,public.event_role)') IS NOT NULL THEN
   REVOKE ALL ON FUNCTION public.create_auto_conversations_for_event_role(uuid,uuid,public.event_role) FROM PUBLIC,anon,authenticated;
   GRANT EXECUTE ON FUNCTION public.create_auto_conversations_for_event_role(uuid,uuid,public.event_role) TO service_role;
 END IF;
 IF to_regprocedure('public.handle_user_event_role_auto_conversations()') IS NOT NULL THEN
   REVOKE ALL ON FUNCTION public.handle_user_event_role_auto_conversations() FROM PUBLIC,anon,authenticated;
 END IF;
END;
$$;
COMMIT;
