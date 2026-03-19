# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Essential commands for development:
- `npm run dev` - Start development server on localhost:3000 (run from repo root; `package.json` is in `MentorMates/`)

### Local login (bypass Google OAuth)

Google OAuth is not required for local development. Use **email/password** on the login page:

1. Open **http://localhost:3000/login**
2. Use **Sign In** (or **Sign Up** if you don’t have an account).
3. Enter any email and password (e.g. `dev@local.test` / `password123`).
4. Sign up creates the user in Supabase; sign in then redirects into the app.

Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing to your Supabase project (local or hosted). Email confirmation is disabled in Supabase config, so sign-up works immediately.
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks
- `npm run setup-db` - Initialize database with env-cmd using .env.local

## Project Architecture

**MentorMate** is a Next.js 15 application for hackathon mentor-participant feedback system built with TypeScript, Supabase, and TailwindCSS.

### Core Architecture Patterns

**Next.js App Router Structure:**
- Uses App Router with TypeScript and route groups for organization
- Route groups: `(static)` for public pages, `(users)` for authenticated pages
- Dynamic routes for events `[id]` and projects `[projectId]`
- API routes in `app/api/` for backend functionality

**Authentication & Authorization:**
- Supabase Auth integration with middleware-based session management
- Role-based access control: participant, mentor, judge, organizer, admin
- `AuthProvider` wraps the app with authentication state management
- `AuthRedirectProvider` handles automatic redirects based on auth state
- Public routes defined in `AuthProvider` with regex patterns for dynamic routes

**Database Architecture:**
- Supabase PostgreSQL with TypeScript-generated types in `lib/database.types.ts`
- Key tables: `user_event_roles`, `projects`, `project_scores`
- Role-based row-level security (RLS) policies
- Migration files in `supabase/migrations/` with versioned naming

**State Management:**
- React Context for auth state in `AuthProvider`
- Custom hooks: `use-profile.ts`, `use-project.ts`, `use-toast.ts`
- Form handling with `react-hook-form` and Zod validation

### Component Organization

**UI Components:**
- Radix UI primitives in `components/ui/` with consistent styling
- Custom components follow feature-based organization
- Dashboard components for each role type (admin, participant, mentor, etc.)

**Layout Structure:**
- Root layout with gradient background and responsive design
- Development-only Stagewise toolbar integration
- Toast notifications via Sonner

### Key Integrations

**Supabase Integration:**
- Client-side: `app/utils/supabase/client.ts`
- Server-side: `app/utils/supabase/server.ts`  
- Middleware: `app/utils/supabase/middleware.ts`
- Session management across client/server boundary

**Email System:**
- Nodemailer integration for notifications
- Template system in `app/email-templates/`
- Google APIs integration via `googleapis`

**QR Code Functionality:**
- Project sharing via QR codes using `qrcode.react`
- QR scanning with `@yudiel/react-qr-scanner`

## Project Structure

**Feature-Based Architecture (Newly Implemented):**
```
features/
├── projects/                    # Project management feature
│   ├── components/
│   │   ├── forms/              # ProjectSubmissionForm, SubmissionConfirmation
│   │   ├── displays/           # ProjectBoard, my-project-section
│   │   ├── feedback/           # FeedbackForm
│   │   └── management/         # project-dashboard
│   ├── hooks/                  # use-project
│   └── utils/                  # projects helpers
└── user/                       # User management feature  
    ├── authentication/         # AuthProvider, AuthRedirectProvider
    ├── dashboards/            # Role-specific dashboards
    ├── profiles/              # Profile management
    └── roles/                 # Role utilities

lib/
├── config/          # Configuration and constants
├── templates/       # Email templates  
├── hooks/          # Shared React hooks
├── utils/          # Shared utility functions
└── types/          # TypeScript type definitions

app/
├── (auth)/         # Authentication pages
├── (users)/        # User-specific pages  
├── api/           # API routes
└── utils/supabase/ # Next.js specific Supabase utilities
```

## Development Guidelines

## Project Detail Route Parity (Required)

Keep these two routes synced for shared behavior and UI:
- `app/projects/[id]/page.tsx` (private/authenticated view)
- `app/projects/public/[id]/page.tsx` (public view)

UI parity is required: core project-detail layout, section order, copy, and visual hierarchy must stay aligned across both routes.
- Private-only controls (edit/delete/team management) can differ, but non-sensitive presentation UI should match.
- If you change project-detail logic in one route, update the other in the same PR unless the difference is intentionally role/privacy-specific.
- Prefer extracting shared code into common `features/projects` or `lib` modules to prevent drift.
- Prefer shared presentational components for project-detail sections to enforce consistent UI.
- Add or update tests that cover both routes whenever shared behavior changes.
- If a difference is intentional, leave a short code comment explaining the reason and include it in the PR notes.

**File Naming:**
- Components use PascalCase: `AuthProvider.tsx`
- Pages use kebab-case: `page.tsx`
- Utilities use camelCase: `invite-links.ts`

**Import Paths:**
- Project Components: `@/features/projects/components/{forms,displays,feedback,management}/*`
- User Components: `@/features/user/{authentication,dashboards,profiles,roles}/*`  
- Project Hooks: `@/features/projects/hooks/*`
- Shared Hooks: `@/lib/hooks/*`
- Templates: `@/lib/templates/*`
- Config: `@/lib/config/*`
- Types: `@/lib/types/*`

**Database Operations:**
- Use TypeScript types from `lib/database.types.ts`
- Prefer server-side operations for sensitive data
- Follow RLS policies for data access

**Authentication Flow:**
- Check auth state in `AuthProvider` before accessing protected routes
- Use role-based conditionals for feature access
- Handle auth redirects via `AuthRedirectProvider`

**Environment Setup:**
- Requires `.env.local` with Supabase credentials
- Development includes Stagewise toolbar for debugging
- Database setup via `npm run setup-db` command

## Branching and Pull Requests

- **Always use Pull Requests (PRs).** Do not push directly to main.
- **Branch names must be meaningful.** Use your name, AI agent, or feature name.
  - Examples: `chinat/fix-feedback-modal`, `cursor/mentor-agent-scoring`
  - Avoid generic names like `frontend`, `dev`, `fix`

## Plan File Naming

When creating plan files for Claude Code sessions, use descriptive names that reflect the task:
- Use kebab-case: `fix-auth-redirect-bug.md`, `add-mentor-dashboard-feature.md`
- Include the feature or area being worked on
- Avoid generic names like `plan.md` or random word combinations
- Examples:
  - `refactor-project-submission-form.md`
  - `update-email-templates.md`
  - `fix-qr-scanner-permissions.md`

## Pre-PR Checklist

Before creating a pull request, always:
1. Remove all console.log() statements added during development (console.error for error handling is acceptable)
2. Run `npm run build` to ensure the project builds successfully
3. Run `npm run lint` to check for linting errors

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
