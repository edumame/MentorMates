import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { z } from 'zod';
import { InvitationStatus } from '@/features/invitations/types';
import { inngest } from '@/lib/inngest/client';

// Request schema
const sendSchema = z.object({
  invitationIds: z.array(z.string().uuid()).optional(),
  sendAll: z.boolean().optional().default(false),
  customMessage: z.string().optional(),
});

/**
 * POST /api/events/[eventId]/invitations/send
 * 
 * Send approved invitations via email (triggers Inngest queue)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId } = await context.params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is organizer or admin for this event
    const { data: userRole } = await supabase
      .from('user_event_roles')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: isAdmin } = await supabase.rpc('is_admin_user', { user_id: user.id });

    const isOrganizer = userRole?.role === 'organizer' || userRole?.role === 'admin';
    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { invitationIds, sendAll, customMessage } = parsed.data;

    // Build query to get invitations to send
    let query = supabase
      .from('event_invitations')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', InvitationStatus.APPROVED);

    if (!sendAll && invitationIds && invitationIds.length > 0) {
      query = query.in('id', invitationIds);
    }

    const { data: invitationsToSend, error: queryError } = await query;

    if (queryError) {
      console.error('Error fetching invitations to send:', queryError);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    if (!invitationsToSend || invitationsToSend.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No approved invitations to send',
        queued: 0,
      }, { status: 400 });
    }

    const idsToSend = invitationsToSend.map(inv => inv.id);

    // If custom message provided, update invitations with it
    if (customMessage) {
      await supabase
        .from('event_invitations')
        .update({ custom_message: customMessage })
        .in('id', idsToSend);
    }

    // Trigger Inngest to send emails in batches
    try {
      await inngest.send({
        name: 'invitation/send.batch',
        data: {
          eventId,
          invitationIds: idsToSend,
        },
      });
    } catch (inngestError) {
      console.error('Error triggering Inngest:', inngestError);
      return NextResponse.json(
        { error: 'Failed to queue invitations for sending' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      queued: idsToSend.length,
      message: `${idsToSend.length} invitation(s) queued for sending`,
    });
  } catch (error) {
    console.error('Error in send endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

