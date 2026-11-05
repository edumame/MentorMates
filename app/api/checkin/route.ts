import { NextResponse } from 'next/server'
import { getAuthContext } from '@/app/api/events/[eventId]/intake-forms/_shared'

export async function GET(request: Request) {
  try {
    // `event` is the event being scanned for; `evt` and `usr` come from the QR
    const { searchParams } = new URL(request.url)
    const scanningEventId = searchParams.get('event')
    const eventId = searchParams.get('evt')
    const userId = searchParams.get('usr')

    if (!scanningEventId || !eventId || !userId) {
      return NextResponse.json(
        { error: 'No event ID or user ID provided' },
        { status: 400 }
      )
    }

    const { supabase, user, isOrganizer, isAdmin } =
      await getAuthContext(scanningEventId)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json(
        { error: 'Only organizers of this event can check in attendees' },
        { status: 403 }
      )
    }

    if (eventId !== scanningEventId) {
      return NextResponse.json(
        { error: 'This ticket is for a different event' },
        { status: 403 }
      )
    }

    // Check if user is registered for the event
    const { data: userRole, error: roleError } = await supabase
      .from('user_event_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single()

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'User is not registered for this event' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { message: 'Successfully checked in' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json(
      { error: 'Invalid check-in token' },
      { status: 401 }
    )
  }
}
