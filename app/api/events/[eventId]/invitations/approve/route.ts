import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { z } from 'zod';
import { InvitationStatus } from '@/features/invitations/types';

// Request schema
const approveSchema = z.object({
  invitationIds: z.array(z.string().uuid()).min(1, 'At least one invitation ID is required'),
  approveAll: z.boolean().optional().default(false),
});

/**
 * POST /api/events/[eventId]/invitations/approve
 * 
 * Approve selected invitations (moves them from pending to approved)
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
    const parsed = approveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { invitationIds, approveAll } = parsed.data;

    let query = supabase
      .from('event_invitations')
      .update({ status: InvitationStatus.APPROVED })
      .eq('event_id', eventId)
      .eq('status', InvitationStatus.PENDING);

    if (!approveAll) {
      query = query.in('id', invitationIds);
    }

    const { data: updated, error: updateError } = await query.select('id');

    if (updateError) {
      console.error('Error approving invitations:', updateError);
      return NextResponse.json({ error: 'Failed to approve invitations' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      approved: updated?.length || 0,
      message: `${updated?.length || 0} invitation(s) approved`,
    });
  } catch (error) {
    console.error('Error in approve endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

