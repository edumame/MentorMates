import { presentProfile, publicDisplayName, publicTeammateLabels } from './profile-presentation';

const profile = {
  uid: 'user', display_name: ' Member ', bio: 'Public biography', affiliation: 'School',
  avatar_url: 'https://example.test/avatar', cover_image_url: 'https://example.test/cover',
  email: 'private@example.test', stripe_customer_id: 'cus_private', onboarding_metadata: { secret: 'private' },
  future_secret: 'private', links: { github: 'https://github.com/member', secret: 'private' },
};
it('returns exactly the public presentation allowlist', () => {
  expect(presentProfile(profile, false)).toEqual({
    uid: 'user', display_name: 'Member', bio: 'Public biography', affiliation: 'School',
    avatar_url: 'https://example.test/avatar', cover_image_url: 'https://example.test/cover',
    links: { github: 'https://github.com/member' },
  });
});
it('adds only owner email and the separately fetched phone', () => {
  const result = presentProfile(profile, true, '+15555555555');
  expect(result).toEqual({ ...presentProfile(profile, false), email: 'private@example.test', phone_number: '+15555555555' });
  expect(JSON.stringify(result)).not.toContain('cus_private');
  expect(result).not.toHaveProperty('future_secret');
});
it.each(['javascript:alert(1)', 'data:text/html,secret', 'mailto:private@example.test', 'https://user:password@example.test', 'bad'])('rejects unsafe social URL %s', link => {
  expect(presentProfile({ ...profile, links: { github: link } }, false).links).toEqual({});
});
it('does not serialize unknown nested keys or non-string link values', () => {
  expect(presentProfile({ ...profile, links: { github: { secret: 'private' }, portfolio: 'https://example.test/site', private_email: 'private' } }, false).links).toEqual({ portfolio: 'https://example.test/site' });
});
it.each([null, '', '  ', 'private@example.test'])('uses a neutral display name for %s', name => {
  expect(publicDisplayName(name)).toBe('User');
});
it('preserves deliberately authored biography rather than rewriting its content', () => {
  expect(presentProfile({ ...profile, bio: 'Contact author@example.test' }, false).bio).toBe('Contact author@example.test');
});
it('preserves teammate count with safe labels and handles missing arrays', () => {
  expect(publicTeammateLabels(['a@example.test', 'b@example.test'])).toEqual(['Team member 1', 'Team member 2']);
  expect(publicTeammateLabels(null)).toEqual([]);
});
