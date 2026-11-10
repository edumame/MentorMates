ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS provisioning_failed boolean NOT NULL DEFAULT false;

-- Provider output is server-controlled even when clients can edit their meeting.
CREATE OR REPLACE FUNCTION public.protect_meeting_provider_urls()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.provisioning_failed
       AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Failed provisioning requires server reconciliation' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.transcript_url IS NOT NULL OR NEW.recording_url IS NOT NULL OR NEW.provisioning_failed THEN
      RAISE EXCEPTION 'Meeting provider URLs are server-managed' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.transcript_url IS DISTINCT FROM OLD.transcript_url
     OR NEW.recording_url IS DISTINCT FROM OLD.recording_url
     OR NEW.provisioning_failed IS DISTINCT FROM OLD.provisioning_failed THEN
    RAISE EXCEPTION 'Meeting provider URLs are server-managed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_meeting_provider_urls ON public.meetings;
CREATE TRIGGER protect_meeting_provider_urls BEFORE INSERT OR UPDATE OR DELETE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.protect_meeting_provider_urls();
