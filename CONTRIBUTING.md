# Contributing to MentorMates

Thanks for your interest in improving MentorMates. Bug reports, focused fixes, tests, and documentation improvements are welcome.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Before you start

- Search existing [issues](https://github.com/edumame/MentorMates/issues) and [pull requests](https://github.com/edumame/MentorMates/pulls) to avoid duplicate work.
- Open an issue first for larger behavioral changes, new features, or anything that changes the database schema or row-level security policies.

## Development setup

1. Fork the repository and clone your fork.
2. Install dependencies with `pnpm install`.
3. Copy `.env.example` to `.env.local` and fill in values for **your own** development services. See [Environment configuration](README.md#environment-configuration) in the README.
4. Start the dev server with `pnpm dev` and open [localhost:3000](http://localhost:3000).

Use a dedicated, non-production Supabase project. A reproducible empty-database bootstrap is not available yet; see the README for current limitations.

## Making a change

- **Branch names** should be meaningful, e.g. `yourname/fix-feedback-modal` or `feature/mentor-scoring`. Avoid generic names like `dev` or `fix`.
- **Keep pull requests focused.** One logical change per PR is easier to review and safer to revert.
- **Add tests.** Unit tests are colocated with application code. Add regression coverage for bug fixes and cover both success and failure paths.
- **Project-detail parity.** Keep the private route (`app/projects/[id]/page.tsx`) and public route (`app/projects/public/[id]/page.tsx`) aligned in layout, section order, copy, and visual hierarchy. Prefer shared components, test both routes when shared behavior changes, and explain any intentional access-controlled difference in a code comment and the PR.
- **Database changes** go in a new, timestamped file under `supabase/migrations/`. Never edit a migration that may already have been applied. Describe in the PR whether the migration must be applied before or after the code deploys.
- **No secrets.** Never commit credentials, tokens, real user data, or personal email addresses. Use environment variables and document new ones in `.env.example` and the README.
- **Remove debugging output.** Delete `console.log()` calls added during development; `console.error` for real error handling is fine.

Coding agents should also read [AGENTS.md](AGENTS.md).

## Validate before opening a PR

Run the same checks as the [validation workflow](.github/workflows/validation.yml):

```sh
pnpm lint
pnpm typecheck
pnpm test:unit --ci --runInBand
pnpm build --webpack
node scripts/check-homepage-prerender.mjs
```

The build needs environment variables; the placeholders in `.env.example` are enough for it to succeed.

## Opening a pull request

Target the `main` branch and fill in the [pull request template](.github/pull_request_template.md). Describe:

- The problem and the resulting behavior.
- How you validated the change (commands run, manual checks, screenshots for UI changes).
- Any migration, environment variable, or third-party configuration it requires.
- The issue it closes, if any (`Closes #123`).

A maintainer will review it. Please be patient: this project is maintained by volunteers.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
