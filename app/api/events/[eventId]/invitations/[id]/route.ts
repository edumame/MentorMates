import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';

/**
 * GET /api/events/[eventId]/invitations/[id]
 * 
 * Get a single invitation by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId, id } = await context.params;

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

    // Fetch the invitation
    const { data: invitation, error: queryError } = await supabase
      .from('event_invitations')
      .select('*')
      .eq('id', id)
      .eq('event_id', eventId)
      .single();

    if (queryError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/events/[eventId]/invitations/[id]
 * 
 * Update an invitation (e.g., change custom message, name)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId, id } = await context.params;

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

    // Check invitation exists
    const { data: existing } = await supabase
      .from('event_invitations')
      .select('id, status')
      .eq('id', id)
      .eq('event_id', eventId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Parse request body - only allow certain fields to be updated
    const body = await request.json();
    const allowedFields = ['name', 'first_name', 'last_name', 'phone_number', 'custom_message'];
    const updates: Record<string, string | null> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field] ?? null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update the invitation
    const { data: invitation, error: updateError } = await supabase
      .from('event_invitations')
      .update(updates)
      .eq('id', id)
      .eq('event_id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, invitation });
  } catch (error) {
    console.error('Error updating invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/events/[eventId]/invitations/[id]
 * 
 * Delete an invitation
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId, id } = await context.params;

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

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('event_invitations')
      .delete()
      .eq('id', id)
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

