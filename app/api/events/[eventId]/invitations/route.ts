import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { z } from 'zod';
import type { InvitationStats, InvitationFilters } from '@/features/invitations/types';
import { InvitationStatus, InvitationSource } from '@/features/invitations/types';

// Query parameter schema
const querySchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Create invitation schema
const createInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone_number: z.string().optional(),
  custom_message: z.string().optional(),
});

/**
 * GET /api/events/[eventId]/invitations
 * 
 * List all invitations for an event with optional filters
 */
export async function GET(
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParsed = querySchema.safeParse({
      status: searchParams.get('status'),
      source: searchParams.get('source'),
      search: searchParams.get('search'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, source, search, page, limit } = queryParsed.data;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('event_invitations')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      const statuses = status.split(',');
      query = query.in('status', statuses);
    }

    if (source) {
      const sources = source.split(',');
      query = query.in('source', sources);
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: invitations, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error fetching invitations:', queryError);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Get statistics
    const { data: statsData } = await supabase
      .from('event_invitations')
      .select('status')
      .eq('event_id', eventId);

    const stats: InvitationStats = {
      total: statsData?.length || 0,
      pending: 0,
      approved: 0,
      sent: 0,
      accepted: 0,
      expired: 0,
      bounced: 0,
      declined: 0,
    };

    statsData?.forEach(inv => {
      const status = inv.status as keyof Omit<InvitationStats, 'total'>;
      if (status in stats) {
        stats[status]++;
      }
    });

    return NextResponse.json({
      invitations,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/events/[eventId]/invitations
 * 
 * Create a single manual invitation
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
    const parsed = createInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name, first_name, last_name, phone_number, custom_message } = parsed.data;

    // Check if invitation already exists
    const { data: existing } = await supabase
      .from('event_invitations')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'An invitation for this email already exists', existingStatus: existing.status },
        { status: 409 }
      );
    }

    // Create the invitation
    const { data: invitation, error: insertError } = await supabase
      .from('event_invitations')
      .insert({
        event_id: eventId,
        email: email.toLowerCase(),
        name: name || null,
        first_name: first_name || null,
        last_name: last_name || null,
        phone_number: phone_number || null,
        custom_message: custom_message || null,
        status: InvitationStatus.PENDING,
        source: InvitationSource.MANUAL,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating invitation:', insertError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, invitation }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

