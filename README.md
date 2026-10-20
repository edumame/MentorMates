# MentorMates

MentorMates helps hackathon teams connect with mentors, collect actionable feedback, and share their work. Organizers can manage events and submissions, while judges evaluate projects using event-specific scoring criteria.

[Source repository](https://github.com/edumame/MentorMates) · [Issues](https://github.com/edumame/MentorMates/issues) · [MIT license](LICENSE)

## Features

- Event creation, participant management, tracks, and project submissions.
- Participant, mentor, judge, organizer, and administrator workflows.
- Mentor feedback, booking availability, and project sharing.
- Project scoring and judging dashboards.
- Supabase authentication and database access controls.
- Integrations for AI assistance, email, chat/video, and payments.

The application uses Next.js App Router, React, TypeScript, Supabase, Tailwind CSS, and Radix UI. External integrations require their own configuration; they are not included services.

## Development setup

### Prerequisites

- **Node.js 22 recommended**, matching CI. Newer releases are not covered by the current CI matrix.
- **pnpm 9.12.3**, pinned in the `packageManager` field in [package.json](package.json).
- For authenticated or database-backed development, a dedicated **non-production Supabase environment with a compatible schema**, test data, and Auth configuration.

### Install

```sh
git clone https://github.com/edumame/MentorMates.git
cd MentorMates
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm install --frozen-lockfile
```

If Corepack is unavailable, install pnpm 9.12.3 using your Node tooling before running the final command. Keep `pnpm-lock.yaml` as the dependency source of truth.

### Database setup: current limitation

**A reproducible empty-database bootstrap is not available yet.** The [migration directory](supabase/migrations) contains incremental changes that depend on pre-existing tables and types. There is also a historical schema dump, but it is not a verified current bootstrap. Do not assume `supabase db reset` or applying all migrations to a fresh project will produce a working environment.

`setup-db.ts` is currently empty: `pnpm setup-db` does **not** initialize the database. For database-backed work, coordinate with a maintainer to obtain a compatible, sanitized development baseline and confirm which migrations it already includes. Review migration changes against that baseline before applying them to a disposable development database. Do not connect local development or automated tests to production.

You can install dependencies and run unit checks without a live database. End-to-end authentication and data workflows need the compatible development environment described above.

### Environment configuration

Copy [`.env.example`](.env.example) to `.env.local` in the repository root; `.env.local` is ignored by Git. The template lists every variable the application reads, grouped by integration.

The following **non-working placeholders** match the production-build validation configuration. They support build validation without real service credentials; they do not provide a functioning database, authentication, email, AI, or chat service.

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder
SUPABASE_SERVICE_ROLE_KEY=build-placeholder
OPENAI_API_KEY=build-placeholder
RESEND_API_KEY=re_build_placeholder
NEXT_PUBLIC_STREAM_CHAT_API_KEY=build-placeholder
STREAM_CHAT_SECRET_KEY=build-placeholder
NEXT_PUBLIC_STREAM_VIDEO_API_KEY=build-placeholder
STREAM_VIDEO_SCRET_KEY=build-placeholder
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
NEXT_TELEMETRY_DISABLED=1
```

For functional development, replace placeholders only with credentials for your isolated development services:

| Configuration | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Local origin used for redirects and generated links. Keep it set to your local application URL. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Core browser and server Supabase connection. Configure the development project's Auth redirects for `http://localhost:3000/auth/callback`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged database operations. Use the matching development project key; never expose it through a `NEXT_PUBLIC_` variable. |
| `OPENAI_API_KEY` | Optional AI-backed features. |
| `RESEND_API_KEY` | Optional email delivery; use a test configuration and authorized sender. |
| `NEXT_PUBLIC_STREAM_CHAT_API_KEY`, `STREAM_CHAT_SECRET_KEY` | Optional Stream chat integration. |
| `NEXT_PUBLIC_STREAM_VIDEO_API_KEY`, `STREAM_VIDEO_SCRET_KEY` | Optional Stream video integration. `SCRET` is the current spelling in the source. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional payments and webhooks; use Stripe test mode. See [payment integration notes](docs/payments/stripe.md). |

These are the main application variables, not an exhaustive inventory of every integration. Some optional SDKs initialize during builds, which is why CI supplies placeholders even when those features are not exercised. Variables beginning with `NEXT_PUBLIC_` are exposed to the browser. Keep service secrets server-only and out of commits, screenshots, logs, and issue reports.

### Run locally

After configuring the development environment:

```sh
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Placeholder-only configuration is useful for build checks, but database-backed pages and external integrations will not work.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test:unit --ci --runInBand
pnpm build --webpack
node scripts/check-homepage-prerender.mjs
```

These commands mirror the [validation workflow](.github/workflows/validation.yml). The build needs environment configuration; CI uses non-production placeholders. The prerender check inspects the generated homepage body for its heading and footer, excluding serialized script content. Run it after a successful build.

To serve the production build locally, run `pnpm start`.

Browser tests use Playwright separately from Jest:

```sh
pnpm test:e2e:install
pnpm test:e2e
```

The [Playwright configuration](playwright.config.ts) starts a local development server by default. To use an already running local server, set `PLAYWRIGHT_SKIP_WEB_SERVER=1`; `PLAYWRIGHT_BASE_URL` overrides the default `http://localhost:3000`. Use a test environment for journeys that require accounts or data. Browser tests are not currently part of the validation workflow, and passing unit/build checks does not establish that all external integrations work.

## Repository layout

| Path | Contents |
| --- | --- |
| `app/` | App Router pages, API handlers, and Supabase server/browser helpers. |
| `features/` | Project, event, user, and other feature-specific UI and logic. |
| `components/` | Shared UI, layouts, and event/project components. |
| `lib/` | Types, database clients, integrations, and shared application utilities. |
| `supabase/` | Incremental database migrations and historical SQL assets. |
| `e2e/` | Playwright browser tests. |
| `scripts/` | Validation and integration utilities; inspect each before running it. |
| `.github/workflows/` | CI and repository automation. |

Unit tests are colocated with application code. [Generated database types](lib/database.types.ts) describe the expected schema but do not create it.

## Contributing

Bug reports, focused fixes, tests, and documentation improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and the pull request checklist, and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security vulnerability, follow [SECURITY.md](SECURITY.md). Do not publish exploit details, private user data, or credentials in a public issue.

## Current limitations and next steps

Open-source contributor setup is still being improved. Priorities include:

- A tested initial database baseline and sanitized seed data.
- Database-backed tests for permissions, migrations, and concurrent writes.
- Browser coverage in CI for critical participant, organizer, and judging workflows.
- Simplifying shared data access and project-detail presentation to reduce duplication.
- Integration setup documentation for each optional service.

These are improvement areas, not guarantees that every workflow is complete or that pending pull requests are ready to merge. Use [issues](https://github.com/edumame/MentorMates/issues) and [pull requests](https://github.com/edumame/MentorMates/pulls) to discuss scope and track work.

## License and contact

Copyright (c) 2026 MentorMates contributors. Licensed under the [MIT License](LICENSE).

Questions, partnerships, and community inquiries: [contact@mentormates.ai](mailto:contact@mentormates.ai).
