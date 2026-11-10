import type { SupabaseClient } from '@supabase/supabase-js';
import { TRPCError } from '@trpc/server';

/** Provider credentials require the same owner/staff boundary as meeting details. */
export async function requireMeetingAccess(supabase: SupabaseClient, userId: string, meetingId: string) {
  const { data: meeting, error } = await supabase.from('meetings')
    .select('id,user_id,event_id,name,provisioning_failed').eq('id', meetingId).maybeSingle();
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unable to load meeting' });
  if (!meeting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
  if (meeting.provisioning_failed) throw new TRPCError({ code: 'CONFLICT', message: 'Meeting setup failed; create a new meeting' });
  if (meeting.user_id === userId) return meeting;
  if (meeting.event_id) {
    const { data: admin, error: adminError } = await supabase.rpc('is_admin_user', { user_id: userId });
    if (adminError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unable to check meeting access' });
    if (admin === true) return meeting;
    const { data: event, error: eventError } = await supabase.from('events')
      .select('owner_id').eq('event_id', meeting.event_id).maybeSingle();
    if (eventError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unable to check meeting access' });
    if (event?.owner_id === userId) return meeting;
    const { data: role, error: roleError } = await supabase.from('user_event_roles').select('role')
      .eq('event_id', meeting.event_id).eq('user_id', userId).in('role', ['organizer', 'admin']).maybeSingle();
    if (roleError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unable to check meeting access' });
    if (role?.role === 'organizer' || role?.role === 'admin') return meeting;
  }
  throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to access this meeting' });
}
