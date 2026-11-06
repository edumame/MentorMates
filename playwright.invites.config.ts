import { defineConfig, devices } from '@playwright/test';

process.env.INVITE_REGRESSION = '1';

// These credentials only address the local fixture; no production writes occur.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'invite-acceptance.spec.ts',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:3107', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/fixtures/invite-supabase.mjs',
      url: 'http://127.0.0.1:54329/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 3107',
      url: 'http://127.0.0.1:3107/login',
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'invite-test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'invite-test-service-key',
        JWT_SECRET: 'invite-regression-only-secret',
        NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3107',
      },
    },
  ],
});
