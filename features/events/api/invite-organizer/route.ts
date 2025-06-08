import { createSupabaseClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { EventRole } from '@/lib/types';

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  const { eventId, email } = await request.json();

  if (!auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!eventId || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: role } = await supabase
    .from('user_event_roles')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!role || (role.role !== EventRole.Organizer && role.role !== EventRole.Admin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: user } = await supabase
    .from('user_profiles')
    .select('uid')
    .eq('email', email)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { error } = await supabase.from('user_event_roles').upsert(
    {
      user_id: user.uid,
      event_id: eventId,
      role: EventRole.Organizer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,event_id' },
  );

  if (error) {
    return NextResponse.json({ error: 'Failed to invite organizer' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
