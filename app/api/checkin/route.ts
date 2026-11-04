import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/app/utils/supabase/server'
import { isValidUUID } from '@/app/utils/supabase/queries'
import { canAccessRole } from '@/features/user/roles/roles'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { EventRole } from '@/lib/types'

// POST, not GET: a scan writes the check-in record, so a link or prefetch must
// not be able to trigger it from a staff member's session.
export async function POST(request: Request) {
  try {
    // Initialize Supabase client
    const supabase = await createSupabaseClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user) {
      return NextResponse.json(
        { error: 'Sign in as event staff to check people in' },
        { status: 401 }
      )
    }

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

    if (!isValidUUID(eventId) || !isValidUUID(userId)) {
      return NextResponse.json(
        { error: 'Invalid check-in QR code' },
        { status: 400 }
      )
    }

    // Allow organizers of this event OR global admins
    const { data: staffRole } = await supabase
      .from('user_event_roles')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    let isStaff = false
    if (staffRole && canAccessRole(staffRole.role as EventRole, EventRole.Organizer)) {
      isStaff = true
    } else {
      const { data: isAdmin } = await supabase.rpc('is_admin_user', {
        user_id: auth.user.id,
      })
      isStaff = Boolean(isAdmin)
    }

    if (!isStaff) {
      return NextResponse.json(
        { error: 'Only event staff can check people in' },
        { status: 403 }
      )
    }

    const { data, error } = await createSupabaseServiceClient().rpc(
      'record_event_checkin',
      {
        p_event_id: eventId,
        p_user_id: userId,
        p_checked_in_by: auth.user.id,
      }
    )

    if (error) {
      throw error
    }

    const checkin = data?.[0]

    if (checkin?.outcome === 'not_registered') {
      return NextResponse.json(
        { error: 'User is not registered for this event' },
        { status: 403 }
      )
    }

    if (checkin?.outcome === 'already_checked_in') {
      return NextResponse.json(
        { error: 'Already checked in', timestamp: checkin.recorded_at },
        { status: 409 }
      )
    }

    if (checkin?.outcome !== 'checked_in') {
      throw new Error('Check-in was not recorded')
    }

    return NextResponse.json(
      { message: 'Successfully checked in', timestamp: checkin.recorded_at },
      { status: 200 }
    )

  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json(
      { error: 'Failed to process check-in' },
      { status: 500 }
    )
  }
}
