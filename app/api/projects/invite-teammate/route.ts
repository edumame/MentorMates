import { createSupabaseClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { NOTIFICATIONS_EMAIL_FROM } from '@/lib/email_templates/constants';
import { getProjectInvitationEmailTemplate } from '@/lib/email_templates/project-invitation';

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

  const normalizedEmail = email.trim().toLowerCase();

  // Check if the email is already on the project (in teammates array or team_members table)
  const isAlreadyTeammate = project.teammates?.includes(normalizedEmail);
  const isTheProjectLead = project.lead_email === normalizedEmail;

  // Also check project_team_members table
  const { data: existingMember } = await supabase
    .from('project_team_members')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (isAlreadyTeammate || isTheProjectLead || existingMember) {
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

  // Create invitation record in project_team_members table
  // This allows tracking invitations even before the user signs up
  const { data: teamMember, error: teamMemberError } = await supabase
    .from('project_team_members')
    .insert({
      project_id: projectId,
      email: normalizedEmail,
      invited_by_user_id: auth.user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (teamMemberError) {
    console.error('Error creating team member record:', teamMemberError);
    return NextResponse.json({ error: 'Failed to create invitation record' }, { status: 500 });
  }

  // Check if the invited user already has an account
  const { data: existingUser } = await supabase
    .from('user_profiles')
    .select('uid, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  // If user exists, update the team member record with their user_id
  if (existingUser) {
    await supabase
      .from('project_team_members')
      .update({ user_id: existingUser.uid })
      .eq('id', teamMember.id);
  }

  // Send invitation email
  try {
    const emailTemplate = getProjectInvitationEmailTemplate(
      project.project_name || 'Untitled Project',
      project.id,
      inviterName,
      eventName,
    );

    const { error: emailError } = await resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: normalizedEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the request - invitation record is created, email can be resent
      return NextResponse.json({ 
        success: true, 
        message: 'Invitation created but email failed to send',
        warning: 'Please try resending the invitation'
      }, { status: 200 });
    }
  } catch (emailErr) {
    console.error('Error sending invitation email:', emailErr);
    // Don't fail the request - invitation record is created
    return NextResponse.json({ 
      success: true, 
      message: 'Invitation created but email failed to send',
      warning: 'Please try resending the invitation'
    }, { status: 200 });
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Invitation sent successfully',
    userExists: !!existingUser
  });
}
