import { createSupabaseClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { NOTIFICATIONS_EMAIL_FROM } from '@/lib/email_templates/constants';
import { getProjectInvitationEmailTemplate } from '@/lib/email_templates/project-invitation';
import { generateEmailInviteHash } from '@/lib/utils/invite-links';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  const { projectId, email } = await request.json();

  if (!auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!projectId || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate email format server-side
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Fetch project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, project_name, lead_email, teammates, event_id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check if the user is the project lead or already a teammate
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('uid', auth.user.id)
    .single();

  const userEmail = userProfile?.email;

  // Verify user has permission (is project lead or teammate)
  const isProjectLead = project.lead_email === userEmail;
  const isTeammate = project.teammates?.includes(userEmail || '');

  if (!isProjectLead && !isTeammate) {
    return NextResponse.json({ error: 'Forbidden: Only project lead or teammates can invite others' }, { status: 403 });
  }

  // Check if the email is already on the project
  const isAlreadyTeammate = project.teammates?.includes(email.trim().toLowerCase());
  const isTheProjectLead = project.lead_email === email.trim().toLowerCase();

  if (isAlreadyTeammate || isTheProjectLead) {
    return NextResponse.json({ error: 'This person is already on the project' }, { status: 400 });
  }

  // Get event details if project is part of an event
  let eventName: string | undefined;
  if (project.event_id) {
    const { data: eventData } = await supabase
      .from('events')
      .select('event_name')
      .eq('event_id', project.event_id)
      .single();
    eventName = eventData?.event_name;
  }

  // Fetch inviter's name
  const { data: inviterProfile } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('uid', auth.user.id)
    .single();

  const inviterName = inviterProfile?.display_name || userEmail || 'A teammate';

  if (!resend) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  // Generate secure hash based on the invitee's email
  const normalizedEmail = email.trim().toLowerCase();
  const hash = generateEmailInviteHash(project.id, normalizedEmail);

  // Create or update a project invitation row (idempotent on pending invites)
  // Try to resolve invited_user_id by email if exists
  let invitedUserId: string | null = null;
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('uid, email')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (existingProfile?.uid) {
    invitedUserId = existingProfile.uid;
  }

  // Upsert pending invitation (unique on project_id + invited_email when pending)
  const { error: inviteError } = await supabase
    .from('project_invitations')
    .upsert(
      {
        project_id: project.id,
        event_id: project.event_id || null,
        inviter_user_id: auth.user.id,
        invited_email: normalizedEmail,
        invited_user_id: invitedUserId,
        hash,
        status: 'pending',
        expires_at: null,
      },
      { onConflict: 'project_id,hash' }
    );

  if (inviteError) {
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }

  // Insert an in-app notification for existing user
  if (invitedUserId) {
    await supabase.from('notifications').insert({
      user_id: invitedUserId,
      type: 'project_invite',
      title: `You were invited to ${project.project_name}`,
      body: eventName ? `at ${eventName}` : null,
      data: {
        projectId: project.id,
        eventId: project.event_id,
        hash,
        inviterName,
      },
      status: 'unread',
    });
  }

  // Send invitation email
  try {
    const emailTemplate = getProjectInvitationEmailTemplate(
      project.project_name || 'Untitled Project',
      project.id,
      inviterName,
      eventName,
      hash
    );

    const { error: emailError } = await resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: normalizedEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (emailError) {
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Error sending invitation email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Invitation sent successfully' });
}
