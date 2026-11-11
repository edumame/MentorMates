import { createSupabaseClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { EventRole } from '@/lib/types';
import { Resend } from 'resend';
import { NOTIFICATIONS_EMAIL_FROM } from '@/lib/email_templates/constants';
import { canAccessRole } from '@/features/user/roles/roles';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendOrganizerInviteEmails } from '@/lib/events/invite-emails';
import { reserveInviteQuota } from '@/lib/email/invite-quota';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  const { eventId, email } = await request.json();

  if (!auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!eventId || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate email format server-side
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Allow organizers of this event OR global admins
  const { data: userRole } = await supabase
    .from('user_event_roles')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  
  let isAllowed = false;
  if (userRole && canAccessRole(userRole.role as EventRole, EventRole.Organizer)) {
    isAllowed = true;
  } else {
    const { data: isAdmin } = await supabase.rpc('is_admin_user', {
      user_id: auth.user.id,
    });
    isAllowed = Boolean(isAdmin);
  }

  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const serviceSupabase = createSupabaseServiceClient();

  // Fetch event details for the email
  const { data: eventData } = await supabase
    .from('events')
    .select('event_name')
    .eq('event_id', eventId)
    .single();

  if (!eventData) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Fetch inviter's name
  const { data: inviterProfile } = await supabase
    .from('user_profiles')
    .select('email, display_name')
    .eq('uid', auth.user.id)
    .single();

  const inviterName = inviterProfile 
    ? `${inviterProfile.display_name}`.trim()
    : 'A MentorMates organizer';

  const inviteEmail = email.trim().toLowerCase();

  // The account lookup only picks the email wording (sign up vs sign in).
  // user_profiles.email mirrors the verified auth email (MENT-008 migration).
  const { data: user } = await serviceSupabase
    .from('user_profiles')
    .select('uid')
    .eq('email', inviteEmail)
    .maybeSingle();

  // ORG-012: never grant the organizer role here. Every invitee, existing
  // account or not, receives a signed invitation and becomes an organizer only
  // after accepting it while signed in with this email
  // (app/api/events/[eventId]/accept-invite).
  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: 'Email is not configured (RESEND_API_KEY missing)' },
      { status: 503 }
    );
  }

  // ORG-012: per-inviter and per-event daily caps.
  const quotaResponse = await reserveInviteQuota(serviceSupabase, auth.user.id, eventId);
  if (quotaResponse) return quotaResponse;

  const summary = await sendOrganizerInviteEmails({
    appOrigin: process.env.NEXT_PUBLIC_APP_URL ?? '',
    eventId,
    eventName: eventData.event_name,
    inviterName,
    existingOrganizerEmails: user ? [inviteEmail] : [],
    newOrganizerEmails: user ? [] : [inviteEmail],
    sendEmail: async (message) => {
      const { error } = await resend.emails.send({
        from: NOTIFICATIONS_EMAIL_FROM,
        ...message,
      });
      if (error) console.error('Failed to send organizer invitation email:', error);
      return !error;
    },
  });

  if (summary.failed.length > 0) {
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
  }

  // Uniform response: whether the address has an account is not disclosed.
  return NextResponse.json({ success: true });
}
