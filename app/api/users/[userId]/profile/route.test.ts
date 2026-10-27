/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
const uid = '11111111-1111-4111-8111-111111111111';
type Op = [string, unknown[]];
let viewer: string | null, authError: boolean, missing: boolean, failedTable: string | null;
let viewerEmail: string | undefined;
let profile: Record<string, unknown>, projects: Record<string, unknown>[];
let verifiedPhones: {phone_number: string}[], recentPhones: {phone_number: string}[];
const calls: { client: string; table: string; ops: Op[] }[] = [];
function from(client: string) {
  return (table: string) => {
    const ops: Op[] = [];
    calls.push({ client, table, ops });
    const result = () => {
      if (failedTable === table) return { data: null, error: { message: 'private-error-canary', code: 'private-code' } };
      if (client === 'service' && table !== 'user_profiles') throw new Error('Privileged non-profile query');
      if (table === 'user_profiles') return { data: missing ? null : profile, error: null };
      if (table === 'projects') return { data: projects, error: null };
      if (table === 'events' || table === 'prize_winners') return { data: [], error: null };
      if (table === 'user_phone_numbers') return { data: ops.some(([op, args]) => op === 'eq' && args[0] === 'verification_status') ? verifiedPhones : recentPhones, error: null };
      throw new Error(`Unexpected table ${table}`);
    };
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'or', 'contains', 'in', 'order', 'limit', 'maybeSingle']) {
      chain[op] = (...args: unknown[]) => { ops.push([op, args]); return chain; };
    }
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return chain;
  };
}
beforeEach(() => {
  jest.clearAllMocks(); calls.length = 0;
  viewerEmail = 'account-private@example.test';
  viewer = null; authError = false; missing = false; failedTable = null;
  profile = { uid, display_name: 'Member', bio: '', affiliation: 'School', avatar_url: null, cover_image_url: null,
    email: 'account-private@example.test', phone_number: 'old-phone-canary', stripe_customer_id: 'stripe-canary',
    onboarding_metadata: { secret: 'onboarding-canary' }, future_secret: 'future-canary', links: { github: 'https://github.com/member', secret: 'link-canary' } };
  projects = [];
  verifiedPhones = [{ phone_number: '+15555555555' }]; recentPhones = [{ phone_number: '+16666666666' }];
  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: viewer ? { id: viewer, email: viewerEmail } : null }, error: authError ? new Error('private-auth-canary') : null }) },
    from: from('caller'),
  } as never);
  jest.mocked(createSupabaseServiceClient).mockReturnValue({ from: from('service') } as never);
});
const run = () => GET(new NextRequest('https://example.test/api/profile'), { params: Promise.resolve({ userId: uid }) });

it.each(['anonymous', 'other', 'auth-error'])('does not disclose private fields for %s', async mode => {
  viewer = mode === 'anonymous' ? null : mode === 'auth-error' ? uid : 'other'; authError = mode === 'auth-error';
  const response = await run(); expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body = await response.json();
  expect(Object.keys(body.profile).sort()).toEqual(['uid','display_name','bio','affiliation','avatar_url','cover_image_url','links'].sort());
  for (const canary of ['account-private', 'old-phone-canary', 'stripe-canary', 'onboarding-canary', 'future-canary', 'link-canary']) expect(JSON.stringify(body)).not.toContain(canary);
  expect(calls.some(call => call.table === 'user_phone_numbers')).toBe(false);
  for (const call of calls.filter(call => call.table === 'projects')) {
    expect(call.client).toBe('caller'); expect(call.ops).toContainEqual(['or', ['submitted.eq.true']]);
  }
  expect(calls.find(call => call.table === 'events')?.ops).toContainEqual(['in', ['visibility', ['public']]]);
});
it('returns owner contact fields and preserves own drafts/events without internal metadata', async () => {
  viewer = uid; const response = await run(); expect(response.status).toBe(200); const body = await response.json();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(body.profile.email).toBe('account-private@example.test'); expect(body.profile.phone_number).toBe('+15555555555');
  expect(body.profile).not.toHaveProperty('stripe_customer_id'); expect(body.profile).not.toHaveProperty('onboarding_metadata');
  expect(calls.filter(call => call.table === 'user_phone_numbers')).toHaveLength(1);
  expect(calls.find(call => call.table === 'projects')?.ops).toContainEqual(['or', ['submitted.eq.false,submitted.eq.true']]);
  expect(calls.find(call => call.table === 'events')?.ops).toContainEqual(['in', ['visibility', expect.arrayContaining(['private','draft'])]]);
});
it('uses the recent phone only when no verified phone exists', async () => {
  viewer = uid; verifiedPhones = []; expect((await (await run()).json()).profile.phone_number).toBe('+16666666666');
  expect(calls.filter(call => call.table === 'user_phone_numbers')).toHaveLength(2);
});
it('degrades phone lookup errors to null for owner', async () => {
  viewer = uid; failedTable = 'user_phone_numbers'; const response = await run(); expect(response.status).toBe(200); expect((await response.json()).profile.phone_number).toBeNull();
});
it('redacts nested project email identities while preserving avatar count and deduplicating', async () => {
  projects = [{ id: 'project', project_name: 'Project', lead_name: 'lead-private@example.test', lead_email: 'lead-private@example.test', teammates: ['member-private@example.test','other-private@example.test'], event_id: 'event', submitted: true, project_tracks: [], secret: 'project-secret' }];
  const body = await (await run()).json(); expect(body.projects).toHaveLength(1);
  expect(body.projects[0]).not.toHaveProperty('lead_email'); expect(body.projects[0].lead_name).toBe('Project lead');
  expect(body.projects[0].teammates).toEqual(['Team member 1','Team member 2']);
  for (const canary of ['lead-private', 'member-private', 'other-private', 'project-secret']) expect(JSON.stringify(body)).not.toContain(canary);
});
it('preserves owner project identity needed for own-project controls', async () => {
  viewer = uid; projects = [{ id: 'project', lead_email: 'account-private@example.test', teammates: ['teammate@example.test'], project_tracks: [] }];
  const body = await (await run()).json(); expect(body.projects[0].lead_email).toBe('account-private@example.test'); expect(body.projects[0].teammates).toEqual(['teammate@example.test']);
});
it('does not query legacy memberships when the profile has no email', async () => {
  profile.email = null; const response = await run(); expect(response.status).toBe(200); expect(calls.some(call => call.table === 'projects')).toBe(false);
});
it('returns 404 for missing profiles', async () => { missing = true; expect((await run()).status).toBe(404); });
it.each(['user_profiles', 'projects', 'events'])('returns generic errors for %s failures without privileged fallback', async table => {
  failedTable = table; const response = await run(); expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain('private-');
  expect(calls.filter(call => call.client === 'service').every(call => call.table === 'user_profiles')).toBe(true);
});
it('does not expose thrown authentication error details', async () => {
  jest.mocked(createSupabaseClient).mockRejectedValueOnce(new Error('private-exception-canary'));
  const response = await run(); expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'Internal server error' });
});

it('does not trust editable profile email for owner membership or disclose unrelated identities', async () => {
  viewer = uid; profile.email = 'spoofed@example.test';
  projects = [{ id: 'unrelated', lead_name: 'other@example.test', lead_email: 'spoofed@example.test', teammates: ['secret-member@example.test'], project_tracks: [] }];
  const body = await (await run()).json();
  const projectQueries = calls.filter(call => call.table === 'projects');
  expect(projectQueries[0].ops).toContainEqual(['eq', ['lead_email', 'account-private@example.test']]);
  expect(projectQueries[1].ops).toContainEqual(['contains', ['teammates', ['account-private@example.test']]]);
  expect(body.projects[0]).not.toHaveProperty('lead_email');
  expect(body.projects[0].lead_name).toBe('Project lead');
  expect(body.projects[0].teammates).toEqual(['Team member 1']);
  expect(JSON.stringify(body.projects)).not.toContain('@example.test');
});
it('does not fall back to editable profile email when verified owner has no auth email', async () => {
  viewer = uid; viewerEmail = undefined;
  expect((await run()).status).toBe(200);
  expect(calls.some(call => call.table === 'projects')).toBe(false);
});
it('preserves member identities when the verified owner is a teammate', async () => {
  viewer = uid; projects = [{ id: 'team-project', lead_email: 'lead@example.test', teammates: ['account-private@example.test'], project_tracks: [] }];
  const body = await (await run()).json();
  expect(body.projects[0].lead_email).toBe('lead@example.test');
  expect(body.projects[0].teammates).toEqual(['account-private@example.test']);
});
