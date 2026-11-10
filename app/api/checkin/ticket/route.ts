import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/app/utils/supabase/server'
import { generateEventCheckinToken } from '@/lib/utils/jwt'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Issues the signed check-in ticket for the *signed-in* user only (PUB-007).
// The ticket page never trusts a user id from the URL.
export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('eventId')?.trim() ?? ''
  if (!UUID_PATTERN.test(eventId)) {
    return NextResponse.json({ error: 'A valid event is required' }, { status: 400 })
  }

  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to view your ticket' }, { status: 401 })
  }

  const { data: role, error } = await supabase
    .from('user_event_roles')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Ticket role lookup failed:', error)
    return NextResponse.json({ error: 'Could not load your ticket' }, { status: 500 })
  }

  if (!role) {
    return NextResponse.json(
      { error: 'You are not registered for this event' },
      { status: 403 }
    )
  }

  const token = await generateEventCheckinToken({ eventId, userId: user.id })
  return NextResponse.json({ token })
}
