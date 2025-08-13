import { NextResponse } from 'next/server'
import { verifyCheckinJwt } from '@/lib/utils/jwt'
import { createSupabaseClient } from '@/app/utils/supabase/server'

export async function GET(request: Request) {
  try {
    // Get token from query params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'No check-in token provided' },
        { status: 400 }
      )
    }

    // Verify JWT token
    const claims = await verifyCheckinJwt(token)
    const { eventId, userId } = claims

    // Initialize Supabase client
    const supabase = await createSupabaseClient()

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
