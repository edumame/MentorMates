import { createSupabaseClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import { EventRole } from '@/lib/types';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canAccessRole } from '@/features/user/roles/roles';
import {
  isPasswordJoinableRole,
  validateRolePassword,
  type PasswordJoinableRole,
} from '@/lib/roles/role-passwords';

type AuthorizedRequest =
  | { error: NextResponse }
  | { eventId: string; role: PasswordJoinableRole; password: unknown };

/** Parses the body and checks the caller organizes the event (or is admin). */
async function authorizeOrganizer(request: Request): Promise<AuthorizedRequest> {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const body = await request.json().catch(() => null);
  const eventId = body?.eventId;
  const role = body?.role;
  if (typeof eventId !== 'string' || !eventId || !role) {
    return { error: NextResponse.json({ error: 'Missing required fields' }, { status: 400 }) };
  }

  // Organizer access is invitation-only, so it cannot have a role password.
  if (!isPasswordJoinableRole(role)) {
    return { error: NextResponse.json({ error: 'Invalid role' }, { status: 400 }) };
  }

  const { data: userRole } = await supabase
    .from('user_event_roles')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('event_id', eventId)
    .maybeSingle();

  let allowed = Boolean(userRole && canAccessRole(userRole.role as EventRole, EventRole.Organizer));
  if (!allowed) {
    const { data: isAdmin } = await supabase.rpc('is_admin_user', { user_id: auth.user.id });
    allowed = Boolean(isAdmin);
  }
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { eventId, role, password: body?.password };
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeOrganizer(request);
    if ('error' in auth) return auth.error;

    if (typeof auth.password !== 'string' || !auth.password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const invalid = validateRolePassword(auth.role, auth.password);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(auth.password, 10);

    // Hash columns are not readable or writable by clients; use the trusted
    // writer only after the organizer authorization above.
    const { error } = await createSupabaseServiceClient()
      .from('role_passwords')
      .upsert({
        event_id: auth.eventId,
        role: auth.role,
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'event_id,role'
      });

    if (error) {
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Password set successfully' });
  } catch (error) {
    console.error('Error setting role password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Removes a role password, closing password-based joins for that role. */
export async function DELETE(request: Request) {
  try {
    const auth = await authorizeOrganizer(request);
    if ('error' in auth) return auth.error;

    const { error } = await createSupabaseServiceClient()
      .from('role_passwords')
      .delete()
      .eq('event_id', auth.eventId)
      .eq('role', auth.role);

    if (error) {
      return NextResponse.json({ error: 'Failed to remove password' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Password removed' });
  } catch (error) {
    console.error('Error removing role password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
