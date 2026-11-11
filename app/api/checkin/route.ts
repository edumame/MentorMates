import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/app/utils/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { verifyEventCheckinToken } from '@/lib/utils/jwt'

// PUB-007: check-in used to be an unauthenticated GET that trusted raw
// ?evt=&usr= values and answered "Successfully checked in" without recording
// anything. It is now an organizer-only verification of a server-signed ticket.
//
// Attendance is persisted in event_checkins (migration 202611110101); a repeat
// scan returns 409 with the first scan time.

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

  // record_event_checkin inserts the first scan atomically (primary key on
  // event_id + user_id) and marks one held ticket used; repeats report the
  // original scan time instead of succeeding again.
  const { data: checkinRows, error: checkinError } = await service.rpc('record_event_checkin', {
    p_event_id: ticket.eventId,
    p_user_id: ticket.userId,
    p_checked_in_by: user.id,
  })

  if (checkinError) {
    console.error('Check-in record failed:', checkinError)
    return NextResponse.json({ error: 'Could not record this check-in' }, { status: 500 })
  }

  const checkin = checkinRows?.[0]
  const attendee = {
    name: profile?.display_name || 'Registered attendee',
    role: attendeeRole.role,
  }

  if (checkin?.outcome === 'not_registered') {
    return NextResponse.json(
      { error: 'This ticket holder is no longer registered for this event' },
      { status: 404 }
    )
  }

  if (checkin?.outcome === 'already_checked_in') {
    return NextResponse.json(
      {
        error: 'Already checked in',
        alreadyCheckedIn: true,
        timestamp: checkin.recorded_at,
        attendee,
      },
      { status: 409 }
    )
  }

  if (checkin?.outcome !== 'checked_in') {
    console.error('Check-in returned an unexpected outcome:', checkin?.outcome)
    return NextResponse.json({ error: 'Could not record this check-in' }, { status: 500 })
  }

  return NextResponse.json({
    verified: true,
    recorded: true,
    timestamp: checkin.recorded_at,
    attendee,
    message: 'Attendance recorded.',
  })
}
