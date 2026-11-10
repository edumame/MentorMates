import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/app/utils/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { verifyEventCheckinToken } from '@/lib/utils/jwt'

// PUB-007: check-in used to be an unauthenticated GET that trusted raw
// ?evt=&usr= values and answered "Successfully checked in" without recording
// anything. It is now an organizer-only verification of a server-signed ticket.
//
// NOTE (needs product decision): attendance is NOT persisted yet — there is no
// checked_in_at column. The response says so explicitly (`recorded: false`)
// instead of claiming a check-in happened.

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST with a ticket token' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to check attendees in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const ticket = token ? await verifyEventCheckinToken(token) : null

  if (!ticket) {
    return NextResponse.json(
      { error: 'This is not a valid MentorMates ticket' },
      { status: 400 }
    )
  }

  const [{ data: isOrganizer }, { data: isAdmin }] = await Promise.all([
    supabase.rpc('is_event_organizer_or_owner', {
      p_event_id: ticket.eventId,
      p_user_id: user.id,
    }),
    supabase.rpc('is_admin_user', { user_id: user.id }),
  ])

  if (!isOrganizer && !isAdmin) {
    // Same answer whether or not the attendee is registered: no oracle.
    return NextResponse.json(
      { error: 'Only organizers of this event can check attendees in' },
      { status: 403 }
    )
  }

  const service = createSupabaseServiceClient()
  const [{ data: attendeeRole, error: roleError }, { data: profile }] = await Promise.all([
    service
      .from('user_event_roles')
      .select('role')
      .eq('event_id', ticket.eventId)
      .eq('user_id', ticket.userId)
      .maybeSingle(),
    service
      .from('user_profiles')
      .select('display_name')
      .eq('uid', ticket.userId)
      .maybeSingle(),
  ])

  if (roleError) {
    console.error('Check-in role lookup failed:', roleError)
    return NextResponse.json({ error: 'Could not verify this ticket' }, { status: 500 })
  }

  if (!attendeeRole) {
    return NextResponse.json(
      { error: 'This ticket holder is no longer registered for this event' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    verified: true,
    recorded: false,
    attendee: {
      name: profile?.display_name || 'Registered attendee',
      role: attendeeRole.role,
    },
    message: 'Ticket verified: this person is registered for the event. Attendance is not recorded yet.',
  })
}
