import { createSupabaseClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { EventRole } from '@/lib/types';
import { Resend } from 'resend';
import { NOTIFICATIONS_EMAIL_FROM } from '@/lib/email_templates/constants';
import { getOrganizerInvitationEmailTemplate } from '@/lib/email_templates/organizer-invitation';
import { canAccessRole } from '@/features/user/roles/roles';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function POST(request: Request) {
  // TODO: Consider implementing rate limiting to prevent invite spam
  // Example: Allow max 10 invites per organizer per hour
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
    .select('event_name, slug')
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

  const { data: user } = await serviceSupabase
    .from('user_profiles')
    .select('uid')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  // If user exists, add them directly as organizer
  if (user) {
    const { error } = await supabase.from('user_event_roles').upsert(
      {
        user_id: user.uid,
        event_id: eventId,
        role: EventRole.Organizer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_id' },
    );

    if (error) {
      return NextResponse.json({ error: 'Failed to invite organizer' }, { status: 500 });
    }

    // Send invitation email for existing user
    const resend = getResend();
    if (resend) {
      try {
        const emailTemplate = getOrganizerInvitationEmailTemplate(
          eventData.event_name,
          eventId,
          inviterName,
          eventData.slug,
          false // isNewUser
        );

        const { error: emailError } = await resend.emails.send({
          from: NOTIFICATIONS_EMAIL_FROM,
          to: email.trim(),
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });

        if (emailError) {
          console.error('Failed to send organizer invitation email:', emailError);
          // Don't fail the entire request if email fails, but log it
        }
      } catch (emailError) {
        console.error('Error sending organizer invitation email:', emailError);
        // Don't fail the entire request if email fails
      }
    }

    return NextResponse.json({ success: true, userExists: true });
  }

  // User doesn't exist - send magic link invite
  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: 'Email is not configured (RESEND_API_KEY missing)' },
      { status: 503 }
    );
  }
  try {
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventData.slug || eventId}/accept-organizer?email=${encodeURIComponent(email.trim())}`;

    const emailTemplate = getOrganizerInvitationEmailTemplate(
      eventData.event_name,
      eventId,
      inviterName,
      eventData.slug,
      true, // isNewUser
      acceptUrl
    );

    const { error: emailError } = await resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: email.trim(),
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (emailError) {
      console.error('Failed to send organizer invitation email:', emailError);
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }
  } catch (emailError) {
    console.error('Error sending organizer invitation email:', emailError);
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, userExists: false });
}
