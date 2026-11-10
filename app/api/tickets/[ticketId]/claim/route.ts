import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';
type Context = { params: Promise<{ ticketId: string }> };
async function identity(context: Context) {
  const { ticketId } = await context.params;
  if (!z.string().uuid().safeParse(ticketId).success) return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
  const client = await createSupabaseClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email) return NextResponse.json({ error: 'Sign in to claim your ticket' }, { status: 401 });
  return { ticketId, user };
}
export async function GET(_request: Request, context: Context) {
  const auth = await identity(context);
  if (auth instanceof NextResponse) return auth;
  const { data: ticket, error } = await createSupabaseServiceClient().from('event_tickets')
    .select('id,event_id,assigned_to_email,assigned_to_user_id,ticket_status,event:events!inner(event_id,event_name,event_date,event_description)')
    .eq('id', auth.ticketId).maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to load ticket' }, { status: 500 });
  // Return no event or recipient details to a caller who merely knows the ID.
  if (!ticket || (ticket.assigned_to_user_id !== auth.user.id &&
      (ticket.assigned_to_user_id || ticket.assigned_to_email?.trim().toLowerCase() !== auth.user.email?.trim().toLowerCase()))) {
    return NextResponse.json({ error: 'Ticket not found for this account' }, { status: 404 });
  }
  return NextResponse.json({ ticket });
}
export async function POST(_request: Request, context: Context) {
  const auth = await identity(context);
  if (auth instanceof NextResponse) return auth;
  const { data: eventId, error } = await createSupabaseServiceClient().rpc('claim_event_ticket', {
    p_ticket_id: auth.ticketId, p_user_id: auth.user.id,
  });
  if (error) {
    const status = error.code === '45000' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 500;
    return NextResponse.json({ error: status === 409 ? 'Event is full. No seats available.' : status === 500 ? 'Unable to claim ticket' : 'Ticket is unavailable for this account' }, { status });
  }
  return NextResponse.json({ success: true, eventId });
}
