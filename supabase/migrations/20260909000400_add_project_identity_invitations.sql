-- M1d: invitation storage is private; bearer tokens contain no contact data.
-- The compatible server must stop issuing the old email-bearing tokens separately.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $owner$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Apply identity migrations as postgres'; END IF;
END; $owner$;

CREATE FUNCTION public.project_invitation_create_as(
  p_project_id uuid, p_token_hash text, p_expires_at timestamptz,
  p_target_kind text, p_recipient_user_id uuid, p_recipient_email text, p_actor uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_id uuid;
BEGIN
  PERFORM project_identity_private.lock_project(p_project_id);
  PERFORM project_identity_private.assert_account(p_actor);
  IF NOT (project_identity_private.is_member(p_project_id, p_actor)
    OR project_identity_private.is_manager(p_project_id, p_actor)) THEN
    RAISE EXCEPTION 'Invitation creation denied' USING ERRCODE = '42501';
  END IF;
  IF p_expires_at IS NULL OR NOT isfinite(p_expires_at) OR p_expires_at <= now()
    OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_target_kind IS NULL OR p_target_kind NOT IN ('user', 'email', 'share') THEN
    RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '22023';
  END IF;
  IF (p_target_kind = 'user' AND (p_recipient_user_id IS NULL OR p_recipient_email IS NOT NULL))
    OR (p_target_kind = 'email' AND (p_recipient_user_id IS NOT NULL OR p_recipient_email IS NULL
      OR btrim(p_recipient_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    OR (p_target_kind = 'share' AND (p_recipient_user_id IS NOT NULL OR p_recipient_email IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid invitation target' USING ERRCODE = '22023';
  END IF;
  INSERT INTO project_identity_private.project_invitations (
    project_id, token_hash, inviter_user_id, recipient_user_id, recipient_email, target_kind, expires_at
  ) VALUES (
    p_project_id, p_token_hash, p_actor, p_recipient_user_id, lower(btrim(p_recipient_email)), p_target_kind, p_expires_at
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

CREATE FUNCTION project_identity_private.accept_invitation(p_project_id uuid, p_token text, p_actor uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_inv project_identity_private.project_invitations%ROWTYPE; v_email text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 43 OR length(p_token) > 256 THEN
    RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '42501';
  END IF;
  PERFORM project_identity_private.lock_project(p_project_id);
  PERFORM project_identity_private.assert_account(p_actor);
  SELECT * INTO v_inv FROM project_identity_private.project_invitations
    WHERE project_id = p_project_id AND token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '42501'; END IF;
  -- An accepted token is never allowed to recreate a subsequently removed member.
  IF v_inv.accepted_at IS NOT NULL THEN
    IF v_inv.accepted_by IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION 'Invitation already consumed' USING ERRCODE = '42501';
    END IF;
    IF project_identity_private.is_member(p_project_id, p_actor) THEN RETURN 'already_accepted'; END IF;
    RETURN 'no_longer_member';
  END IF;
  IF v_inv.revoked_at IS NOT NULL OR v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation is no longer valid' USING ERRCODE = '42501';
  END IF;
  IF v_inv.target_kind = 'user' AND v_inv.recipient_user_id IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'Invitation belongs to another account' USING ERRCODE = '42501';
  ELSIF v_inv.target_kind = 'email' THEN
    SELECT lower(btrim(email)) INTO v_email FROM auth.users
      WHERE id = p_actor AND email_confirmed_at IS NOT NULL;
    IF v_email IS DISTINCT FROM v_inv.recipient_email OR (
      SELECT count(*) FROM auth.users u WHERE lower(btrim(u.email)) = v_email AND u.deleted_at IS NULL
    ) <> 1 THEN
      RAISE EXCEPTION 'Invitation belongs to another account' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NOT (project_identity_private.is_member(p_project_id, v_inv.inviter_user_id)
    OR project_identity_private.is_manager(p_project_id, v_inv.inviter_user_id)) THEN
    RAISE EXCEPTION 'Invitation issuer no longer has access' USING ERRCODE = '42501';
  END IF;
  PERFORM project_identity_private.assert_eligible(p_project_id, p_actor);
  PERFORM project_identity_private.change_member(p_project_id, 'add', p_actor, p_actor, true);
  UPDATE project_identity_private.project_invitations SET accepted_at = now(), accepted_by = p_actor
    WHERE id = v_inv.id;
  RETURN 'joined';
END;
$fn$;

CREATE FUNCTION public.project_invitation_accept(p_project_id uuid, p_token text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.accept_invitation(p_project_id, p_token, auth.uid()); $fn$;
CREATE FUNCTION public.project_invitation_accept_as(p_project_id uuid, p_token text, p_actor uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.accept_invitation(p_project_id, p_token, p_actor); $fn$;

CREATE FUNCTION project_identity_private.revoke_invitation(p_project_id uuid, p_invitation_id uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  PERFORM project_identity_private.lock_project(p_project_id);
  PERFORM project_identity_private.assert_account(p_actor);
  IF NOT (project_identity_private.is_member(p_project_id, p_actor)
    OR project_identity_private.is_manager(p_project_id, p_actor)) THEN
    RAISE EXCEPTION 'Invitation revocation denied' USING ERRCODE = '42501';
  END IF;
  UPDATE project_identity_private.project_invitations SET revoked_at = COALESCE(revoked_at, now())
    WHERE id = p_invitation_id AND project_id = p_project_id;
END;
$fn$;
CREATE FUNCTION public.project_invitation_revoke(p_project_id uuid, p_invitation_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.revoke_invitation(p_project_id, p_invitation_id, auth.uid()); $fn$;
CREATE FUNCTION public.project_invitation_revoke_as(p_project_id uuid, p_invitation_id uuid, p_actor uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.revoke_invitation(p_project_id, p_invitation_id, p_actor); $fn$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA project_identity_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_invitation_create_as(uuid,text,timestamptz,text,uuid,text,uuid),
  public.project_invitation_accept(uuid,text), public.project_invitation_accept_as(uuid,text,uuid),
  public.project_invitation_revoke(uuid,uuid), public.project_invitation_revoke_as(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_invitation_accept(uuid,text), public.project_invitation_revoke(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_invitation_create_as(uuid,text,timestamptz,text,uuid,text,uuid),
  public.project_invitation_accept_as(uuid,text,uuid), public.project_invitation_revoke_as(uuid,uuid,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
