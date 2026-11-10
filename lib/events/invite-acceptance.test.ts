/** @jest-environment node */
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { getPendingInvite } from '@/lib/events/role-invitations';
import { EventRole } from '@/lib/types';
import { redirect } from 'next/navigation';
import { loadInviteAcceptanceEvent, redirectIfInviteAlreadyAccepted } from './invite-acceptance';

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock('@/lib/events/role-invitations', () => ({ getPendingInvite: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

const eventId = '11111111-1111-4111-8111-111111111111';
const event = { event_id: eventId, slug: 'draft-event', event_name: 'Draft event', event_blurb: 'Draft details' };
const verify = getPendingInvite as jest.Mock;
const service = createSupabaseServiceClient as jest.Mock;
const server = createSupabaseClient as jest.Mock;

function query(result: unknown) {
  const chain = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result), maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return { from: jest.fn().mockReturnValue(chain), chain };
}

describe('invitation event loading', () => {
  let db: ReturnType<typeof query>;
  beforeEach(() => {
    jest.clearAllMocks();
    db = query({ data: event, error: null });
    service.mockReturnValue(db);
    verify.mockImplementation(async (token?: string) => (token ? { eventId, role: 'organizer', email: 'invitee@example.test', jti: 'inv-1' } : null));
  });

  it.each(['organizer', 'judge', 'participant'] as const)('loads a draft for a signed %s invitation without requiring membership', async role => {
    verify.mockResolvedValue({ eventId, role, email: 'invitee@example.test' });
    await expect(loadInviteAcceptanceEvent('draft-event', { token: 'signed', role })).resolves.toEqual({ ...event, invitedEmail: 'invitee@example.test' });
    expect(db.chain.eq).toHaveBeenCalledWith('event_id', eventId);
  });

  it('uses the signed event ID when the slug has changed', async () => {
    await expect(loadInviteAcceptanceEvent('old-slug', { token: 'signed', role: 'organizer' })).resolves.toEqual({ ...event, invitedEmail: 'invitee@example.test' });
    expect(db.chain.eq).toHaveBeenCalledWith('event_id', eventId);
  });

  it('does not read protected data without a token', async () => {
    await expect(loadInviteAcceptanceEvent('draft-event', { role: 'organizer' })).resolves.toBeNull();
    expect(service).not.toHaveBeenCalled();
  });

  it('does not read protected data with an expired or forged token', async () => {
    verify.mockResolvedValue(null);
    await expect(loadInviteAcceptanceEvent('draft-event', { token: 'bad', role: 'organizer' })).resolves.toBeNull();
    expect(service).not.toHaveBeenCalled();
  });

  it('does not accept a different role on an organizer URL', async () => {
    verify.mockResolvedValue({ eventId, role: 'judge', email: 'invitee@example.test' });
    await expect(loadInviteAcceptanceEvent('draft-event', { token: 'signed', role: 'organizer' })).resolves.toBeNull();
    expect(service).not.toHaveBeenCalled();
  });

  it('does not read another UUID using a valid token', async () => {
    await expect(loadInviteAcceptanceEvent('22222222-2222-4222-8222-222222222222', { token: 'signed', role: 'organizer' })).resolves.toBeNull();
    expect(service).not.toHaveBeenCalled();
  });

  it('reports a database outage instead of mislabeling it as an invalid invitation', async () => {
    db.chain.maybeSingle.mockResolvedValue({ data: null, error: { code: '08006' } });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(loadInviteAcceptanceEvent('draft-event', { token: 'signed', role: 'organizer' })).rejects.toThrow('Unable to load invitation');
    spy.mockRestore();
  });

  it('returns no event if the signed event was deleted', async () => {
    db.chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    db.chain.single.mockResolvedValue({ data: null, error: null });
    await expect(loadInviteAcceptanceEvent('draft-event', { token: 'signed', role: 'organizer' })).resolves.toBeNull();
  });
});

describe('already accepted invitation redirect', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the authenticated server user to recognize existing access', async () => {
    const db = query({ data: { role: EventRole.Organizer }, error: null });
    server.mockResolvedValue({ ...db, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } });
    await redirectIfInviteAlreadyAccepted(eventId, 'draft-event', EventRole.Organizer);
    expect(db.chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(redirect).toHaveBeenCalledWith('/events/draft-event/overview');
  });

  it('does not read roles or redirect a signed-out visitor', async () => {
    const db = query({ data: null, error: null });
    server.mockResolvedValue({ ...db, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } });
    await redirectIfInviteAlreadyAccepted(eventId, null, EventRole.Organizer);
    expect(db.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('reports a role lookup failure rather than treating it as missing access', async () => {
    const db = query({ data: null, error: { code: '08006' } });
    server.mockResolvedValue({ ...db, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } });
    await expect(redirectIfInviteAlreadyAccepted(eventId, null, EventRole.Organizer)).rejects.toThrow('Unable to check invitation access');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('does not redirect a participant who still needs organizer access', async () => {
    const db = query({ data: { role: EventRole.Participant }, error: null });
    server.mockResolvedValue({ ...db, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } });
    await redirectIfInviteAlreadyAccepted(eventId, null, EventRole.Organizer);
    expect(redirect).not.toHaveBeenCalled();
  });
});
