# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Interactive Review Prompt

Review this plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give me an opinionated recommendation, and ask for my input before assuming a direction.

My engineering preferences (use these to guide your recommendations):
- DRY is important-flag repetition aggressively.
- Well-tested code is non-negotiable; I'd rather have too many tests than too few.
- I want code that's "engineered enough" - not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity).
- Ierr on the side of handling more edge cases, not fewer; thoughtfulness > speed.
- Bias toward explicit over clever.

1. Architecture review
Evaluate:
- Overall system design and component boundaries.
- Dependency graph and coupling concerns.
- Data flow patterns and potential bottlenecks.
- Scaling characteristics and single points of failure.
- Security architecture (auth, data access, API boundaries).

2. Code quality review
Evaluate:
- Code organization and module structure.
- DRY violations-be aggressive here.
- Error handling patterns and missing edge cases (call these out explicitly).
- Technical debt hotspots.
- Areas that are over-engineered or under-engineered relative to my preferences.

3. Test review
Evaluate:
- Test coverage gaps (unit, integration, e2e).
- Test quality and assertion strength.
- Missing edge case coverage-be thorough.
- Untested failure modes and error paths.

4. Performance review
Evaluate:
- N+1 queries and database access patterns.
- Memory-usage concerns.
- Caching opportunities.
- Slow or high-complexity code paths.

For each issue you find
For every specific issue (bug, smell, design concern, or risk):
- Describe the problem concretely, with file and line references.
- Present 2-3 options, including "do nothing" where that's reasonable.
- For each option, specify: implementation effort, risk, impact on other code, and maintenance burden.
- Give me your recommended option and why, mapped to my preferences above.
- Then explicitly ask whether I agree or want to choose a different direction before proceeding.

Workflow and interaction
- Do not assume my priorities on timeline or scale.
- After each section, pause and ask for my feedback before moving on.

BEFORE YOU START: Ask if I want one of two options:
1. BIG CHANGE: Work through this interactively, one section at a time (Architecture -> Code Quality -> Tests -> Performance) with at most 4 top issues in each section.
2. SMALL CHANGE: Work through interactively ONE question per review section.

FOR EACH STAGE OF REVIEW:
- Output the explanation and pros and cons of each stage's questions.
- Output your opinionated recommendation and why.
- Then use AskUserQuestion.
- Number issues, then use letters for options.
- When using AskUserQuestion, make sure each option clearly labels the issue number and option letter so the user doesn't get confused.
- Make the recommended option always the 1st option.

## Cursor Cloud specific instructions

### Services overview

**MentorMates** is a Next.js 15 application (hackathon mentorship platform). The main service is the Next.js app; there is also an optional Express.js worker in `worker/` for AI voice calls.

### Running the dev server

- `pnpm dev` starts the Next.js dev server on port 3000.
- The `worker/` service is a separate Express.js app (`cd worker && pnpm dev`) only needed for AI voice call features.

### Environment variables

A `.env.local` file is required at the repo root. At minimum it needs placeholder values for:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase)
- `RESEND_API_KEY` (Resend throws at module scope in several API routes if missing)
- `NEXT_PUBLIC_STREAM_VIDEO_API_KEY`, `STREAM_VIDEO_SCRET_KEY`, `NEXT_PUBLIC_STREAM_CHAT_API_KEY`, `STREAM_CHAT_SECRET_KEY` (Stream SDKs throw at module scope if missing)
- `OPENAI_API_KEY` (OpenAI client in webhook route throws at module scope if missing)

Without these placeholder values, `pnpm build` will fail during the page data collection phase even though compilation succeeds.

### Build gotcha: worker/ directory

The `worker/` subdirectory has its own `package.json` with separate dependencies (e.g., `cors`, `@types/cors`). The root `tsconfig.json` includes `**/*.ts` which pulls in `worker/src/index.ts` during Next.js type checking. You must run `pnpm install` in `worker/` as well to avoid type errors during `pnpm build`.

### Lint, test, build commands

See `package.json` scripts. Key commands:
- `pnpm lint` -- ESLint (exit 0 = pass; warnings are pre-existing)
- `pnpm test` -- Jest unit tests. Two test suites have pre-existing config issues (a Playwright e2e file picked up by Jest, and a `node:test`-format file incompatible with Jest); all actual unit tests pass.
- `pnpm build` -- Production build (requires `.env.local` with placeholders as described above)

### Pre-commit hooks

Husky runs `lint-staged` on pre-commit, which applies `eslint --fix` and `eslint` to staged `*.{ts,tsx,js,jsx}` files.
