import { createSupabaseClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { NOTIFICATIONS_EMAIL_FROM } from '@/lib/email_templates/constants';
import { getGuestInvitationEmailTemplate } from '@/lib/email_templates/guest-invitation';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  const { eventId, email, scheduleItem } = await request.json();

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

  // Check if user is admin or organizer
  const { data: userRole } = await supabase
    .from('user_event_roles')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  
  let isAllowed = false;
  if (userRole && (userRole.role === 'organizer' || userRole.role === 'admin')) {
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
    .select('display_name')
    .eq('uid', auth.user.id)
    .single();

  const inviterName = inviterProfile?.display_name || 'An event organizer';

  // Send invitation email
  try {
    const emailTemplate = getGuestInvitationEmailTemplate(
      eventData.event_name,
      eventId,
      inviterName,
      eventData.slug,
      scheduleItem
    );

    const { error: emailError } = await resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: email.trim(),
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (emailError) {
      console.error('Failed to send guest invitation email:', emailError);
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }
  } catch (emailError) {
    console.error('Error sending guest invitation email:', emailError);
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

