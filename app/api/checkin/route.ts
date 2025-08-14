import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/app/utils/supabase/server'

export async function GET(request: Request) {
  try {
    // Get token from query params
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('evt')
    const userId = searchParams.get('usr')

    if (!eventId || !userId) {
      return NextResponse.json(
        { error: 'No event ID or user ID provided' },
        { status: 400 }
      )
    }
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
