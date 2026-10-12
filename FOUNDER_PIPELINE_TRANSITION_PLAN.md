# MentorMates Founder Pipeline Transition Plan

Last updated: 2026-02-25

## 1) Goal

Transition MentorMates from a general hackathon platform positioning to a **founder pipeline** product that:

1. Captures participant post-hackathon intent at submission.
2. Lets organizers privately flag high-potential projects.
3. Produces an internal incubation pipeline view (Interested Teams + Top Picks).
4. Exports VC-ready CSV summaries.
5. Preserves strict confidentiality (hackers cannot see internal flags).

---

## 2) Current State Snapshot (What Exists Today)

### Homepage + positioning
- Homepage messaging is broad hackathon/event language, not founder-pipeline-first.
- Key files:
  - `components/heroes/LandingHero.tsx`
  - `components/heroes/components/Work.tsx`
  - `components/heroes/components/Build.tsx`
  - `components/heroes/components/Impact.tsx`
  - `components/layout/CTAJoin.tsx`

### Submission + project model
- `projects` table does **not** contain `incubation_interest` or `admin_flagged`.
- Submission UI/API has no incubation intent capture.
- Key files:
  - `lib/database.types.ts`
  - `features/projects/components/forms/NewProjectSubmissionFormSinglePage.tsx`
  - `features/projects/components/forms/schema/ProjectSubmissionSchema.ts`
  - `app/api/projects/submit/route.ts`
  - `app/api/projects/[projectId]/route.ts`

### Existing near-adjacent feature
- There is a judge-facing `finalist_recommendation` capability.
- This is not equivalent to organizer-private pipeline curation.
- Key files:
  - `features/user/dashboards/dashboard/organizer/details/BasicInfoTab.tsx`
  - `components/project-scoring/default-scoring.tsx`
  - `components/project-scoring/project-scoring-form.tsx`

### Security risk to address
- Multiple reads still use `select("*")`, which risks leaking future private fields.
- Key files:
  - `app/api/projects/user/route.ts`
  - `app/projects/public/[id]/page.tsx`
  - `components/project-scoring/default-scoring.tsx`

### Testing baseline
- No robust automated product test setup is present for these flows (unit/integration/e2e).
- `package.json` does not expose a test script.

---

## 3) Target Product Capabilities (Core Components)

## A. Participant intent capture
- Add `incubation_interest` during project submission with options:
  - `vc`
  - `lifestyle`
  - `social_impact`
  - `none`
- Keep optional and clearly marked confidential.

## B. Organizer-private high-potential flag
- Add `admin_flagged` to projects.
- Only organizers/admins can update/read this field.
- Never expose in participant/public payloads.

## C. Incubation Pipeline dashboard
- New organizer view with two sections:
  - **Interested Teams**: `incubation_interest` in (`vc`, `lifestyle`, `social_impact`)
  - **Top Picks**: Interested + `admin_flagged = true`
- CSV export for both sections.

---

## 4) Transition Plan (Phased)

## Phase 0: Message alignment guardrail (immediate)
- Keep homepage claims aligned to current capabilities until product ships.
- Replace hard claims like investor routing with “building founder pipeline” wording.

Deliverable:
- Copy pass in homepage sections with claim-safe language.

## Phase 1: Data model + backend foundation

### 1.1 DB migration
- Add `incubation_interest` (enum/text with constraint).
- Add `admin_flagged boolean not null default false`.
- Add index for dashboard query performance:
  - `(event_id, submitted, incubation_interest, admin_flagged)`.

### 1.2 Type updates
- Update generated/shared types:
  - `lib/database.types.ts`
  - `lib/types/index.ts`

### 1.3 API contract updates
- Accept and persist `incubation_interest` in:
  - `app/api/projects/submit/route.ts`
  - `app/api/projects/[projectId]/route.ts` (if draft updates need it)
- Add organizer-only endpoint for flagging:
  - `PATCH /api/projects/[projectId]/flag` (recommended) or extend existing route with role checks.

Deliverable:
- Data path fully supports both fields with correct auth checks.

## Phase 2: Submission flow updates (participant)

### 2.1 Form UI
- Add opt-in block at end of submission form:
  - Prompt + four options + confidentiality disclaimer.

### 2.2 Validation
- Extend schema in:
  - `features/projects/components/forms/schema/ProjectSubmissionSchema.ts`

### 2.3 Payload wiring
- Include field in `handlePublish` request payload:
  - `features/projects/components/forms/NewProjectSubmissionFormSinglePage.tsx`

Deliverable:
- Hacker can submit with/without intent; field persists correctly.

## Phase 3: Organizer flagging + curation

### 3.1 Add flag control in submissions UI
- In organizer submissions list:
  - `features/user/dashboards/dashboard/organizer/submissions/index.tsx`
- Add star/toggle per project row.
- Optimistic UI + error state rollback.

### 3.2 Pipeline tab/view
- New organizer tab: “Incubation Pipeline”
- Section 1: Interested Teams
- Section 2: Top Picks
- CSV export includes:
  - project name, lead, team, track(s), interest type, flagged status, links.

Deliverable:
- Organizer can curate and export pipeline without exposing flag to hackers.

## Phase 4: Security hardening (must-do before launch)

### 4.1 Remove wildcard project selects
- Replace `select("*")` with explicit field allowlists in:
  - `app/api/projects/user/route.ts`
  - `app/projects/public/[id]/page.tsx`
  - `components/project-scoring/default-scoring.tsx`
  - Any other project read path.

### 4.2 Enforce role-based exposure
- Ensure `admin_flagged` is only returned to organizer/admin contexts.
- Confirm public project and participant endpoints omit private fields.

### 4.3 RLS/policy validation
- Verify Supabase RLS/policies continue to protect write/read surfaces.

Deliverable:
- Private flag remains internal across API, UI, and DB policy layers.

## Phase 5: Homepage transition (post-feature launch)

### 5.1 Hero + narrative
- Shift from “event management” to “founder pipeline outcome.”

### 5.2 Clear differentiation
- Add comparison strip:
  - submission graveyard vs founder pipeline.

### 5.3 How-it-works
- 3-step visual:
  - hacker intent -> organizer flag -> MentorMates curation to capital/mentors.

### 5.4 Audience-specific CTAs
- Organizers (primary buyer): demo/contact.
- Hackers (secondary): submit/project journey.

Deliverable:
- Marketing message matches shipped product behavior.

---

## 5) Definition of Done

All must be true:

1. `projects` includes `incubation_interest` and `admin_flagged`.
2. Submission form captures and saves intent.
3. Organizer can privately flag/unflag projects.
4. Pipeline view shows both sections correctly.
5. CSV export works for pipeline data.
6. Public/hacker APIs never expose `admin_flagged`.
7. Tests cover happy path + failure + authorization + leakage checks.
8. Homepage copy accurately reflects product state.

---

## 6) Testing Plan (Minimum Required)

## Unit/Component
- Submission form: intent options, default state, serialization.
- Organizer row: flag toggle state transitions + error fallback.
- Pipeline filters: interested vs top picks partitioning.

## API Integration
- Submit project with each interest value.
- Organizer can update `admin_flagged`.
- Non-organizer cannot update `admin_flagged`.
- Public and participant fetches do not include `admin_flagged`.

## E2E
- Participant submits opted-in project.
- Organizer flags project.
- Project appears under both “Interested Teams” and “Top Picks.”
- CSV export includes expected fields and values.

---

## 7) KPI Tracking After Launch

Track weekly:

1. `% submitted projects with incubation_interest != none`.
2. `% interested projects flagged by organizers`.
3. `# top picks exported`.
4. `# intros made to VCs/accelerators/incubators`.
5. `# teams still active 30/60/90 days post-event`.

---

## 8) Recommended Execution Order

1. Phase 1 (DB + API contracts)
2. Phase 4 (security hardening in parallel)
3. Phase 2 (submission UI)
4. Phase 3 (organizer curation + export)
5. Tests
6. Phase 5 homepage transition

This order avoids marketing overpromises and reduces privacy regression risk.

