import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { InvitationStatus } from '@/features/invitations/types';

/**
 * GET /api/invitations/accept/[token]
 * 
 * Accept an invitation via token
 * - Validates the token
 * - Checks expiration
 * - Creates user_event_role if user is authenticated
 * - Redirects to event page
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { token } = await context.params;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mentormates.ai';

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', baseUrl));
    }

    // Find the invitation by token
    const { data: invitation, error: queryError } = await supabase
      .from('event_invitations')
      .select(`
        *,
        events (
          event_id,
          event_name,
          slug
        )
      `)
      .eq('invite_token', token)
      .single();

    if (queryError || !invitation) {
      return NextResponse.redirect(new URL('/login?error=invitation_not_found', baseUrl));
    }

    // Check if invitation is expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from('event_invitations')
        .update({ status: InvitationStatus.EXPIRED })
        .eq('id', invitation.id);

      const eventSlug = invitation.events?.slug || invitation.event_id;
      return NextResponse.redirect(
        new URL(`/events/${eventSlug}?error=invitation_expired`, baseUrl)
      );
    }

    // Check if invitation was already accepted
    if (invitation.status === InvitationStatus.ACCEPTED) {
      const eventSlug = invitation.events?.slug || invitation.event_id;
      return NextResponse.redirect(new URL(`/events/${eventSlug}`, baseUrl));
    }

    // Check if invitation is in a valid state to accept
    const acceptableStatuses = [InvitationStatus.SENT, InvitationStatus.APPROVED];
    if (!acceptableStatuses.includes(invitation.status as typeof InvitationStatus[keyof typeof InvitationStatus])) {
      const eventSlug = invitation.events?.slug || invitation.event_id;
      return NextResponse.redirect(
        new URL(`/events/${eventSlug}?error=invitation_invalid`, baseUrl)
      );
    }

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to login with return URL to accept the invitation
      const eventSlug = invitation.events?.slug || invitation.event_id;
      const returnUrl = `/events/${eventSlug}/accept-invitation?token=${token}`;
      return NextResponse.redirect(
        new URL(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, baseUrl)
      );
    }

    // User is authenticated - check if they already have a role in this event
    const { data: existingRole } = await supabase
      .from('user_event_roles')
      .select('id, role')
      .eq('event_id', invitation.event_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingRole) {
      // Create user_event_role as participant
      const { error: roleError } = await supabase
        .from('user_event_roles')
        .insert({
          event_id: invitation.event_id,
          user_id: user.id,
          role: 'participant',
        });

      if (roleError) {
        console.error('Error creating user_event_role:', roleError);
        // Don't fail - they can still view the event
      }
    }

    // Update invitation status to accepted
    await supabase
      .from('event_invitations')
      .update({
        status: InvitationStatus.ACCEPTED,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    // Redirect to the event page
    const eventSlug = invitation.events?.slug || invitation.event_id;
    return NextResponse.redirect(new URL(`/events/${eventSlug}?welcome=true`, baseUrl));
  } catch (error) {
    console.error('Error accepting invitation:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mentormates.ai';
    return NextResponse.redirect(new URL('/login?error=server_error', baseUrl));
  }
}

/**
 * POST /api/invitations/accept/[token]
 * 
 * Accept invitation via POST (for programmatic use)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { token } = await context.params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Find the invitation by token
    const { data: invitation, error: queryError } = await supabase
      .from('event_invitations')
      .select(`
        *,
        events (
          event_id,
          event_name,
          slug
        )
      `)
      .eq('invite_token', token)
      .single();

    if (queryError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation is expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('event_invitations')
        .update({ status: InvitationStatus.EXPIRED })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Check if invitation was already accepted
    if (invitation.status === InvitationStatus.ACCEPTED) {
      return NextResponse.json({ 
        success: true, 
        alreadyAccepted: true,
        eventId: invitation.event_id,
        eventSlug: invitation.events?.slug,
      });
    }

    // Check if invitation is in a valid state to accept
    const acceptableStatuses = [InvitationStatus.SENT, InvitationStatus.APPROVED];
    if (!acceptableStatuses.includes(invitation.status as typeof InvitationStatus[keyof typeof InvitationStatus])) {
      return NextResponse.json({ error: 'Invitation cannot be accepted' }, { status: 400 });
    }

    // Check if user already has a role in this event
    const { data: existingRole } = await supabase
      .from('user_event_roles')
      .select('id, role')
      .eq('event_id', invitation.event_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingRole) {
      // Create user_event_role as participant
      const { error: roleError } = await supabase
        .from('user_event_roles')
        .insert({
          event_id: invitation.event_id,
          user_id: user.id,
          role: 'participant',
        });

      if (roleError) {
        console.error('Error creating user_event_role:', roleError);
        return NextResponse.json({ error: 'Failed to join event' }, { status: 500 });
      }
    }

    // Update invitation status to accepted
    await supabase
      .from('event_invitations')
      .update({
        status: InvitationStatus.ACCEPTED,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      eventId: invitation.event_id,
      eventSlug: invitation.events?.slug,
      eventName: invitation.events?.event_name,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

