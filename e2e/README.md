# End-to-end tests (Playwright)

## Prerequisites

Install browser binaries once (Chromium is enough for both projects):

```bash
npm run test:e2e:install
# or: pnpm exec playwright install chromium
```

## Projects

| Project            | Use case                                      |
| ------------------ | --------------------------------------------- |
| `chromium-desktop` | Default desktop viewport (1280×720)           |
| `Mobile Chrome`    | Pixel 5 preset (viewport, touch, user agent) |

## Commands

From the repo root (app should be running on `http://localhost:3000`, or use `PLAYWRIGHT_BASE_URL`):

```bash
# All projects (starts `npm run dev` unless CI or reuse skips it)
npm run test:e2e

# Mobile Chrome project only (`host.spec.ts` + `mobile-shell.spec.ts`)
npm run test:e2e:mobile

# Desktop project only (`host.spec.ts`; mobile-only spec excluded)
npm run test:e2e:desktop
```

With a custom base URL:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:mobile
```

If you already have `npm run dev` (or `pnpm dev`) running, skip Playwright’s own server so `baseURL` matches your process:

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e:mobile
```

## CI

Set `CI=true` so Playwright does not reuse an existing dev server and retries are enabled. Install browsers once (e.g. `npx playwright install --with-deps chromium`).

## Troubleshooting

- **`webServer` timeout:** If something is already bound to port 3000, Next may start on another port and the health-check URL will never match. Use `PLAYWRIGHT_SKIP_WEB_SERVER=1` and keep your own dev server on `http://localhost:3000`, or stop the other process so `npm run dev` can use 3000.

## Authenticated mobile shell

The signed-in header (menu, notifications, avatar) lives behind Supabase auth. Extending tests with `storageState` from a `global-setup` script is the usual next step.
