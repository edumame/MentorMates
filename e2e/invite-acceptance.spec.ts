import { expect, test } from '@playwright/test';
import { SignJWT } from 'jose';

const eventId = '11111111-1111-4111-8111-111111111111';
const email = 'invitee@example.test';
const secret = new TextEncoder().encode('invite-regression-only-secret');
const makeToken = (role: string, expires = '1h') => new SignJWT({
  purpose: 'event_role_invite', eventId, role, email,
}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expires).sign(secret);

// Run with playwright.invites.config.ts: the default config has no fixture server.
test.skip(process.env.INVITE_REGRESSION !== '1', 'Requires the isolated invitation fixture config');

for (const role of ['organizer', 'judge', 'participant']) {
  test(`signed-out ${role} can open a valid draft invitation`, async ({ page }) => {
    const token = await makeToken(role);
    const response = await page.goto(`/events/draft-invite-regression/accept-${role}?email=${email}&token=${token}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Draft Invitation Regression' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In to Accept Invitation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '404', exact: true })).toHaveCount(0);
  });
}

test('a valid invite survives a changed event slug', async ({ page }) => {
  const token = await makeToken('organizer');
  await page.goto(`/events/old-event-slug/accept-organizer?token=${token}`);
  await expect(page.getByRole('heading', { name: 'Draft Invitation Regression' })).toBeVisible();
});

for (const scenario of ['missing', 'forged', 'expired', 'wrong-role']) {
  test(`${scenario} invitation never reveals draft details`, async ({ page }) => {
    const token = scenario === 'missing' ? '' : scenario === 'forged' ? 'forged' :
      await makeToken(scenario === 'wrong-role' ? 'judge' : 'organizer', scenario === 'expired' ? '-1h' : '1h');
    const response = await page.goto(`/events/draft-invite-regression/accept-organizer?token=${token}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Return to Home' })).toBeVisible();
    await expect(page.getByText('Draft Invitation Regression', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Private draft details', { exact: true })).toHaveCount(0);
  });
}

test('ordinary draft overview remains inaccessible while signed out', async ({ page }) => {
  await page.goto('/events/draft-invite-regression/overview');
  // Next may stream a not-found boundary with a 200 response; assert its UI.
  await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
  await expect(page.getByText('Draft Invitation Regression', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Private draft details', { exact: true })).toHaveCount(0);
});

test('sign in preserves the full organizer invitation for the return journey', async ({ page }) => {
  const token = await makeToken('organizer');
  const invitePath = `/events/draft-invite-regression/accept-organizer?email=${email}&token=${token}`;
  await page.goto(invitePath);
  await page.getByRole('button', { name: 'Sign In to Accept Invitation' }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('returnUrl'))).toBe(invitePath);
});
