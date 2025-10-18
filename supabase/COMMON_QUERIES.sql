-- ============================================
-- COMMON QUERIES FOR NOTIFICATIONS AND INVITES
-- ============================================
-- This file contains frequently used queries for the notification and invite system
-- Use these as reference when building your API endpoints and UI components

-- ============================================
-- NOTIFICATIONS QUERIES
-- ============================================

-- Get all unread notifications for a user
SELECT * FROM public.notifications
WHERE user_id = '00000000-0000-0000-0000-000000000000' -- Replace with actual user ID
  AND is_read = false
ORDER BY created_at DESC;

-- Get all notifications for a user (with pagination)
SELECT * FROM public.notifications
WHERE user_id = '00000000-0000-0000-0000-000000000000'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

-- Get unread notification count
SELECT COUNT(*) as unread_count
FROM public.notifications
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND is_read = false;

-- Mark a notification as read
UPDATE public.notifications
SET is_read = true
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND user_id = '00000000-0000-0000-0000-000000000000';

-- Mark all notifications as read for a user
UPDATE public.notifications
SET is_read = true
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND is_read = false;

-- Delete old read notifications (cleanup)
DELETE FROM public.notifications
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND is_read = true
  AND created_at < NOW() - INTERVAL '30 days';

-- Get project invite notifications with full project details
SELECT 
  n.*,
  p.project_name,
  p.project_description,
  e.event_name
FROM public.notifications n
LEFT JOIN public.projects p ON n.project_id = p.id
LEFT JOIN public.events e ON n.event_id = e.event_id
WHERE n.user_id = '00000000-0000-0000-0000-000000000000'
  AND n.type = 'project_invite'
ORDER BY n.created_at DESC;

-- ============================================
-- PROJECT INVITES QUERIES
-- ============================================

-- Get all pending invites for a user (by email)
SELECT 
  pi.*,
  p.project_name,
  p.project_description,
  e.event_name
FROM public.project_invites pi
JOIN public.projects p ON pi.project_id = p.id
LEFT JOIN public.events e ON pi.event_id = e.event_id
WHERE pi.invitee_email = 'user@example.com' -- Replace with user email
  AND pi.status = 'pending'
ORDER BY pi.created_at DESC;

-- Get all pending invites for a user (by user_id)
SELECT 
  pi.*,
  p.project_name,
  p.project_description,
  p.lead_name,
  e.event_name
FROM public.project_invites pi
JOIN public.projects p ON pi.project_id = p.id
LEFT JOIN public.events e ON pi.event_id = e.event_id
WHERE pi.invitee_user_id = '00000000-0000-0000-0000-000000000000'
  AND pi.status = 'pending'
ORDER BY pi.created_at DESC;

-- Get invite by token (for magic link validation)
SELECT 
  pi.*,
  p.project_name,
  p.lead_email,
  p.teammates,
  e.event_name,
  e.event_id
FROM public.project_invites pi
JOIN public.projects p ON pi.project_id = p.id
LEFT JOIN public.events e ON pi.event_id = e.event_id
WHERE pi.invite_token = 'abc123token'
  AND pi.status = 'pending';

-- Check if user is already invited to a project
SELECT * FROM public.project_invites
WHERE project_id = '00000000-0000-0000-0000-000000000000'
  AND invitee_email = 'user@example.com'
  AND status IN ('pending', 'accepted');

-- Get all invites for a specific project (for project management view)
SELECT 
  pi.*,
  COALESCE(up.display_name, pi.invitee_email) as invitee_display_name
FROM public.project_invites pi
LEFT JOIN user_profiles up ON pi.invitee_user_id = up.uid
WHERE pi.project_id = '00000000-0000-0000-0000-000000000000'
ORDER BY pi.created_at DESC;

-- Accept an invite
UPDATE public.project_invites
SET status = 'accepted'
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND invitee_email = 'user@example.com'
  AND status = 'pending'
RETURNING *;

-- Decline an invite
UPDATE public.project_invites
SET status = 'declined'
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND invitee_email = 'user@example.com'
  AND status = 'pending'
RETURNING *;

-- Revoke an invite (by project lead)
UPDATE public.project_invites
SET status = 'revoked'
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND project_id = '00000000-0000-0000-0000-000000000000'
  AND status = 'pending'
RETURNING *;

-- Mark expired invites (can be run as a scheduled job)
UPDATE public.project_invites
SET status = 'expired'
WHERE status = 'pending'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

-- ============================================
-- COMBINED QUERIES (Invites + Notifications)
-- ============================================

-- Get pending invites with their corresponding notifications
SELECT 
  pi.*,
  p.project_name,
  e.event_name,
  n.id as notification_id,
  n.is_read as notification_read
FROM public.project_invites pi
JOIN public.projects p ON pi.project_id = p.id
LEFT JOIN public.events e ON pi.event_id = e.event_id
LEFT JOIN public.notifications n ON 
  n.project_id = pi.project_id 
  AND n.type = 'project_invite'
  AND n.user_id = '00000000-0000-0000-0000-000000000000'
WHERE pi.invitee_email = 'user@example.com'
  AND pi.status = 'pending'
ORDER BY pi.created_at DESC;

-- ============================================
-- FULL WORKFLOW: Accept Invite
-- ============================================

-- Step 1: Get invite details and validate
SELECT 
  pi.*,
  p.project_name,
  p.lead_email,
  p.teammates,
  p.event_id
FROM public.project_invites pi
JOIN public.projects p ON pi.project_id = p.id
WHERE pi.invite_token = 'token_from_url'
  AND pi.status = 'pending'
  AND (pi.expires_at IS NULL OR pi.expires_at > NOW());

-- Step 2: Update invite status
UPDATE public.project_invites
SET status = 'accepted'
WHERE id = 'invite_id_from_step1'
RETURNING *;

-- Step 3: Add user to project teammates (in application code)
-- UPDATE projects 
-- SET teammates = array_append(teammates, 'user@example.com')
-- WHERE id = 'project_id'
--   AND NOT ('user@example.com' = ANY(teammates));

-- Step 4: Join user to event (if not already joined)
-- INSERT INTO user_event_roles (user_id, event_id, role)
-- VALUES ('user_id', 'event_id', 'participant')
-- ON CONFLICT (user_id, event_id) DO NOTHING;

-- Step 5: Mark related notification as read
UPDATE public.notifications
SET is_read = true
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND project_id = 'project_id_from_invite'
  AND type = 'project_invite'
  AND is_read = false;

-- ============================================
-- ANALYTICS QUERIES
-- ============================================

-- Get invite acceptance rate for a project
SELECT 
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE status = 'declined') as declined,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'expired') as expired,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'accepted')::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE status IN ('accepted', 'declined'))::numeric, 0) * 100,
    2
  ) as acceptance_rate_percent
FROM public.project_invites
WHERE project_id = '00000000-0000-0000-0000-000000000000';

-- Get average time to accept invites
SELECT 
  AVG(EXTRACT(EPOCH FROM (accepted_at - created_at))) / 3600 as avg_hours_to_accept
FROM public.project_invites
WHERE status = 'accepted'
  AND accepted_at IS NOT NULL;

-- Get most active inviters
SELECT 
  invited_by_user_id,
  invited_by_name,
  COUNT(*) as total_invites_sent,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_invites
FROM public.project_invites
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY invited_by_user_id, invited_by_name
ORDER BY total_invites_sent DESC
LIMIT 10;

-- Get notification engagement metrics
SELECT 
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = true) as read,
  ROUND(
    COUNT(*) FILTER (WHERE is_read = true)::numeric / 
    COUNT(*)::numeric * 100,
    2
  ) as read_rate_percent
FROM public.notifications
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY total DESC;

-- ============================================
-- MAINTENANCE QUERIES
-- ============================================

-- Clean up old read notifications (keep last 30 days)
DELETE FROM public.notifications
WHERE is_read = true
  AND read_at < NOW() - INTERVAL '30 days';

-- Clean up expired invites (mark as expired)
UPDATE public.project_invites
SET status = 'expired'
WHERE status = 'pending'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

-- Find orphaned invites (projects deleted but invites remain - shouldn't happen due to CASCADE)
SELECT pi.*
FROM public.project_invites pi
LEFT JOIN public.projects p ON pi.project_id = p.id
WHERE p.id IS NULL;

-- Find duplicate pending invites (shouldn't exist due to UNIQUE constraint)
SELECT invitee_email, project_id, COUNT(*)
FROM public.project_invites
WHERE status = 'pending'
GROUP BY invitee_email, project_id
HAVING COUNT(*) > 1;
