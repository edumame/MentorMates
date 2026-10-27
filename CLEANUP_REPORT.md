# Repo Cleanup Report

Branch: `chore/repo-cleanup`, 16 commits on top of `main` @ `da47a6c7`. Nothing was pushed.
Result: 66 files changed, 170 lines added, 8,357 removed. Every check that passed at baseline still passes from a clean install. The critic and the verifier both signed off.

## Repo shape

- Package manager: pnpm 9.12.3, with a single `pnpm-lock.yaml` at the root. Not a monorepo: no workspaces, turbo, or nx.
- Framework: Next.js 16.4.1 (App Router), React 18, TypeScript, Jest, Playwright and Supabase.
- `worker/` is a separate, standalone package (`screen-vision-worker`) with its own `pnpm-lock.yaml` and pnpm 10. It is not part of the root install.

## Before / after

| Metric | Before | After |
|---|---|---|
| Direct dependencies | 107 prod + 28 dev = **135** | 82 prod + 31 dev = **113** (22 removed, 5 moved to dev) |
| `node_modules`, clean `--frozen-lockfile` install | **1.7 GB**, 1,534 packages | **1.5 GB**, 1,426 packages |
| `node_modules` as it was on disk | 3.8 GB (1,547 entries) | 1.5 GB |
| Tracked files | 1,133 | 1,076 |
| Tracked bytes in working tree | 41.3 MB | 38.1 MB |
| Client bundle `.next/static` | 9.8 MB | 9.8 MB |
| Bundle JS / CSS | 8,421,856 B / 701,490 B | 8,422,477 B / 695,259 B |

Notes on the numbers:
- Most of the on-disk `node_modules` saving came from deleting the old tree. About 1.86 GB of it was `.ignored*` folders left over from an `npm i` run in this pnpm repo. The fair comparison is the two clean installs: about 200 MB and 108 packages saved by the dependency removals.
- The bundle is unchanged. The removed code was never imported, so it was never bundled. The +621 B of JS is chunk-hash noise. The CSS dropped 6.2 KB because Tailwind no longer scans the deleted components.

## Checks (baseline → after, from a clean install)

| Check | Baseline (main) | After (branch) |
|---|---|---|
| `pnpm install --frozen-lockfile` | pass | pass |
| `pnpm typecheck` | pass | pass |
| `pnpm lint` | 0 errors, 98 warnings | 0 errors, 98 warnings |
| `pnpm test:unit --ci --runInBand` | 124 suites / 926 tests | 123 suites / 925 tests |
| `pnpm build --webpack` (CI env) | pass | pass, identical route list |
| `pnpm test:e2e` | 5 passed, 1 skipped, 1 failed | 5 passed, 1 skipped, 1 failed |
| Runtime smoke test (dev server, 54 routes and 208 asset URLs) | | no new errors |

- **Unit tests:** the count dropped by one because I deleted `scoring-config-form.test.tsx` together with the unused component it tested. That test covered nothing else.
- **E2E:** the one failure was already there before cleanup. `e2e/host.spec.ts` "matches the desktop layout" has no committed macOS (`-darwin`) baseline screenshot. The verifier compared the /host screenshots from main and from the branch and found no pixel differing by more than 30/255.
- **Smoke test:** the verifier requested every non-dynamic `page.tsx` route plus /, /sitemap.xml and /robots.txt. All return 200 on both main and the branch. A few runtime errors appear on both, so they are not caused by cleanup:
  - the Stripe return pages without a `session_id`
  - an unconfigured `next/image` host (`encrypted-tbn0.gstatic.com`)
- **After each batch** I ran typecheck, lint, unit tests and the build. All 16 batches passed and none were reverted.

Side effects of running checks:
- `next dev`, started by Playwright, appends an agent-rules block to `AGENTS.md`. I reverted it every time and never committed it.

## Removed, by commit

| # | Commit | What |
|---|---|---|
| 1 | remove dead participant dashboard and its helpers | `participant-dashboard.tsx`, `journal/goal-section`, `journal/journal-section`, `tickets/view-tickets-tab`, `participant/ProjectsTab`, `use-has-joined-event`. The dashboard was their only importer, and nothing imports it. |
| 2 | remove unused admin/organizer dashboard shims | `admin-dashboard.tsx`, `organizer-dashboard.tsx` (backward-compatibility re-exports nothing imports) |
| 3 | remove unused event components and role switcher | `event-status-bar`, `cancel-registration`, `schedule-editor`, `role-switcher` |
| 4 | remove unused Hero and text-generate effect | `heroes/Hero.tsx`, `ui/text-generate-effect.tsx` |
| 5 | remove unused project-scoring form and example config | `project-scoring-form.tsx`, `example-config.ts` |
| 6 | remove unused email templates | `feedback-notification`, `project-submission`, `project-teammate` |
| 7 | remove unused misc components, hooks and utils | `HackathonHeader`, `announcement-banner`, three empty voting barrels, `use-media-query`, `distribute`, `events/rules.ts`, and the now-unused `defaultRules` export |
| 8 | remove unused project form components | `AvailableTools` with `config/tools`, `IdeaGeneratorCard`, `ProjectSubmissionHeader`, `StepNavigation`, `TrackSelector`, `ProjectBoardContext.enum` |
| 9 | remove unused organizer/judge dashboard modules | `judge/checklist`, `organizer/details`, `organizer/pricing`, `SendNotification`, and `scoring-config-form` with its test (replaced by `CompactScoringForm`) |
| 10 | remove unused sparkles component and @tsparticles deps | `ui/sparkles.tsx`, `@tsparticles/engine`, `@tsparticles/react`, `@tsparticles/slim` |
| 11 | remove six unused exported helpers | `getTestimonialById`, `getRandomTestimonials`, `getPricingTierById`, `ROLE_VIDEOS`, `isMultiRound`, `formatBuiltInVoiceLabel` |
| 12 | remove 15 unreferenced public assets (2.85 MB) | `landing.png` (1.5 MB), `Modern screen mockup.png` (1.3 MB, byte-identical to the "…mockup 2.png" that is in use), 5 create-next-app SVGs, 2 hash-named exports, `close.svg`, `ticket.svg`, `cancel_schedule_send.png`, `devpost.png`, 2× `lovable.svg` |
| 13 | drop 11 unused UI dependencies | `radix-ui`, `@radix-ui/react-icons`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-menu`, `react-remove-scroll`, `next-themes`, `recharts`, `react-date-range`, `@types/react-date-range`, `react-infinite-logo-slider`, `html5-qrcode`. The two Radix internals are still installed through other Radix packages. |
| 14 | drop 8 unused server and tooling dependencies | `googleapis` (181 MB), `@trpc/next`, `@trpc/react-query`, `cookies-next`, `dotenv`, `posthog-node`, `npm-check-updates`, `ts-node` |
| 15 | move type-only packages to devDependencies | `@types/bcrypt`, `@types/nodemailer`, `@types/papaparse`, `@types/pdf-parse`, `@types/qrcode` |
| 16 | untrack worker build output and tidy .gitignore | `git rm --cached worker/dist/index.js` (stale build output, already in `worker/.gitignore`). Removed a duplicate `.pnpm-store` block. Added `.swc/`, `pnpm-debug.log*`, `.eslintcache`, `.claude/settings.local.json` to `.gitignore`. |

## Rejected (by the critic)

- **`daisyui` and the `@plugin "daisyui"` line in `app/globals.css`.** Today they do nothing under Tailwind 3.4, but open PR #608 starts using daisyUI for real, so removing them would break that PR.
- **`setup-db.ts` and the `setup-db` script.** The file is 0 bytes and the script does nothing. They stay for now because CLAUDE.md (lines 23 and 160) and README.md (line 42) tell people to run it. The docs need to change first.

## NEEDS-HUMAN: for you to decide

Code that looks unused but is named in docs or looks intentional:
- **Named in CLAUDE.md or ARCHITECTURE.md, or otherwise documented:**
  - `FeedbackForm.tsx`, which is also the only user of `react-textarea-autosize`
  - `use-project.ts`, `use-profile.ts`, `projects.ts`
  - `my-project-section.tsx`, `SubmissionConfirmation.tsx`
  - `project-dashboard/index.tsx` (36 KB)
  - `organizer/index.tsx`, `organizer-custom`, `UserSearch`, `VoiceInput`
  - `lib/utils/invite-links.ts`
  - These need the docs updated before they can go.
- **Look intentionally kept:**
  - `ComingSoonPage`: it was restored after an earlier deletion.
  - `landing-page.tsx`: it sits in a chain of commits that revert and un-revert it.
  - `lib/email_templates/branded-broadcast.ts`: it looks like unfinished work.
- **`event-page-content-wrapper.tsx`:** it is unused, but open PR #491 edits it.
- **`public/blog/ai-impact-participants.jpg`:** a published blog post used to show it.
- **`scripts/test-email-batching.js` and `test-emails.json`:** no tooling or CI runs them. Convert them to a Jest test or delete them.

Dependencies:
- **`inngest` and `@inngest/agent-kit`** (about 59 MB) are still imported and called from `app/api/webhook` and `app/api/meetings/submit-transcript`. The team says they're no longer really used, so this needs a code change and an owner's decision.
- **Root copies of `express`, `@types/express` and `@stream-io/openai-realtime-api`** are only used by `worker/`, which has its own package.json.
- **The `supabase` CLI** (88 MB binary) is in `dependencies` but no script or CI job uses it.
- **`server-only`** is imported in 6 files but not declared as a dependency.
- **`@trpc/server` is pinned at 11.8.1 while `@trpc/client` is 11.17**, which causes pnpm peer warnings.
- **`pnpm dedupe`:** 135 packages have more than one version. 6 of the 38 `pnpm.overrides` entries target `fast-xml-parser`, which is no longer installed.
- **Swapping libraries** is out of scope for this cleanup:
  - `@mui/icons-material` → `lucide-react`: about 195 MB, since MUI icons pull in `@mui/material` and `@emotion`.
  - `react-icons` → `lucide-react`: about 83 MB; it is only used for 6 brand icons in 1 file.
  - `pdf-parse` → `unpdf`

Repo hygiene and assets:
- **Broken image:** `app/(static)/previous-contributors/page.tsx:17` links to `/img/Matthew.png`, but the file is at `public/team/Matthew.png`.
- **Oversized images:** `public/team/Matthew.png` is 10.4 MB at 3024x4032. With 7 other oversized images, about 20 MB could be saved by compressing to WebP.
- **Loose SQL under `supabase/`:**
  - The `cover_image` ALTERs, the `sync_user_profiles` trigger, `sync_auth` and the schema dump. Some of these objects appear in no migration.
  - Move them into migrations rather than deleting them.
- **Stale docs:**
  - `ARCHITECTURE.md` points to 17 paths that no longer exist, and `EMAIL_IMPLEMENTATION.md` to 2.
  - CLAUDE.md still says Next 15 and npm, and duplicates AGENTS.md.
  - `.cursorrules` is legacy.
  - `setup.sh` runs `npm i` in a pnpm repo, which is what caused the 1.86 GB of `node_modules` debris.
- **Personal tool configs:**
  - `.vscode/settings.json` configures Deno for a nonexistent `supabase/functions`.
  - `.cursor/worktrees.json` runs `npm install`.
- **Local disk only (nothing in git):** I left these alone.
  - A 1.5 GB `.pnpm-store/` sits inside the repo root.
  - `.git` has 366 MiB of loose objects, which a plain `git gc` should reclaim.
- **Git history:** `backup.bundle` (13.8 MB) and 87 old versions of `package-lock.json` (about 50 MB) are still in history. Shrinking that needs a history rewrite, which I didn't do.

## Conflicts with open PRs to expect

The critic kept every deletion away from files that open PRs touch. Removing `next-themes` and `npm-check-updates` changes `package.json` and `pnpm-lock.yaml` lines next to ones that #850 and #662 change, so expect small lockfile conflicts there.

## Time

- Estimated: about 2.5 h, finishing around 7:15 PM PT.
- Actual: started 4:41 PM, finished 5:35 PM PT, about 55 min.

| Phase | Time |
|---|---|
| Baseline | 3 min |
| Finder agents | 6 min |
| Critic | 14 min |
| Apply 16 batches | 20 min |
| Clean verification | 9 min |
| Report | 3 min |

The checks ran much faster than I budgeted, about 75 s per full run.
