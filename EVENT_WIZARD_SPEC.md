# Event Creation Wizard — Spec-Driven Development Plan

> **Goal:** Replace the monolithic tab-based `/events/new` form (~4600 lines, 50+ useState hooks) with a clean 4-step wizard ported from the Event Scraper prototype. Add general "Import from Website" support using TinyFish.

---

## Table of Contents

1. [Spec Overview](#1-spec-overview)
2. [Architecture](#2-architecture)
3. [Type Contracts](#3-type-contracts)
4. [Phase 0 — Preparation](#4-phase-0--preparation)
5. [Phase 1 — Wizard Shell + DetailsStep](#5-phase-1--wizard-shell--detailsstep)
6. [Phase 2 — SubmissionStep](#6-phase-2--submissionstep)
7. [Phase 3 — JudgingStep](#7-phase-3--judgingstep)
8. [Phase 4 — InviteStep + Final Integration](#8-phase-4--invitestep--final-integration)
9. [Phase 5 — Cleanup + Polish](#9-phase-5--cleanup--polish)
10. [Testing Strategy](#10-testing-strategy)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Reference: File Map](#12-reference-file-map)

---

## 1. Spec Overview

### What We're Building

A 4-step event creation wizard that supports two entry points:

| Entry Point | Flow |
|---|---|
| **Create from scratch** | Empty wizard → fill out 4 steps → save/publish |
| **Import from Website** | Paste any hackathon URL → TinyFish scrapes → wizard pre-fills → edit → save/publish |

### The 4 Steps

| Step | Name | What It Covers |
|---|---|---|
| 1 | **Details** | Event name, date, location, slug, blurb, description, cover image, schedule, FAQs, rules, resources |
| 2 | **Submission** | Submission form field builder (WYSIWYG), team settings |
| 3 | **Judging & Tracks** | Tracks, scoring criteria, prizes — edit/preview toggle |
| 4 | **Invite & Share** | Share links, QR codes, participant/judge/organizer invites, access settings |

### What's NOT Changing

- `POST /api/events` — the API contract stays the same
- Database schema — no migrations
- Auth/role system — Supabase session checks
- Existing submission field components (`components/events/submission/`)

### What's NOT Included (Deferred)

- AI chat sidebar (from Event Scraper) — add later
- File upload for rubric/PDF parsing — add later
- Test fixtures and validation suite — add later

### Known Gaps (Post-Phase 4)

These items were identified during review and should be addressed in Phase 5 or a follow-up:

1. **Event Card Preview (DetailsStep)** — The Event Scraper had a live card preview in the right sidebar showing how the event appears to participants (`EventPreviewCard` + `ParticipantEventPreview`). Currently missing from the wizard's DetailsStep. Should be added as a sticky sidebar on desktop.

2. **Judging file import** — The Event Scraper's JudgingStep had a file upload zone (CSV, PDF, DOC) that auto-parses rubrics into tracks and criteria via `/api/ai-chat/parse-file`. Skipped in the initial port. Add as a future enhancement to `TrackEditor`.

3. **Invite tab previews** — The Event Scraper's InviteStep had clickable sub-tabs that showed full previews:
   - **Event Details tab**: Full `ParticipantEventPreview` (what participants see)
   - **Participants tab**: `SubmissionFormPreview` (what the submission form looks like)
   - **Judges tab**: `JudgingPreview` (full judge deck with dummy projects and scoring sliders)

   Currently the Invite step only has Share, Participants (email invite), Judges (email invite), and Organizers. The preview experiences should be added back so organizers can see what each role will see before publishing.

---

## 2. Architecture

### Current State (Tab-Based Monolith)

```
app/events/new/page.tsx          ← 4600 lines, 50+ useState hooks
  ├── Overview tab
  │   ├── Basics sub-tab
  │   ├── Content sub-tab
  │   ├── Schedule sub-tab
  │   ├── Resources sub-tab
  │   ├── Rules sub-tab
  │   ├── FAQs sub-tab
  │   ├── Gallery sub-tab
  │   └── Submission sub-tab
  ├── Access tab
  └── Tracks tab
```

### Target State (4-Step Wizard)

```
app/events/new/
  ├── page.tsx                        ← ~200 lines: auth, prefill, state, render shell
  └── components/
      ├── WizardShell.tsx             ← Step nav, URL import bar, header actions
      ├── DetailsStep.tsx             ← Step 1: basics, content, schedule, FAQs, rules, resources
      ├── SubmissionStep.tsx          ← Step 2: wraps existing submission components
      ├── JudgingStep.tsx             ← Step 3: edit/preview toggle wrapper
      ├── InviteStep.tsx              ← Step 4: share, invites, access
      ├── editors/
      │   ├── BasicInfoEditor.tsx     ← Name, date, location, slug, cover image
      │   ├── ContentEditor.tsx       ← Blurb, description (markdown)
      │   ├── ScheduleEditor.tsx      ← Multi-day schedule CRUD
      │   ├── FAQEditor.tsx           ← Q&A pairs CRUD
      │   ├── RulesEditor.tsx         ← Rule sections CRUD
      │   └── ResourcesEditor.tsx     ← Links CRUD
      └── judging/
          ├── TrackEditor.tsx         ← Track/criteria/prize CRUD
          └── JudgingPreview.tsx      ← Read-only preview

lib/
  ├── types/wizard.ts                 ← WizardEventData type + helpers
  ├── scraper/
  │   ├── goals.ts                    ← TinyFish extraction prompt
  │   └── devpost.ts                  ← Scraper orchestration
  └── tinyfish/
      └── client.ts                   ← TinyFish SSE client

app/api/scrape/route.ts              ← New: TinyFish scrape endpoint
```

### State Management

**Before:** 50+ independent `useState` hooks.

**After:** Single `WizardEventData` object, passed as `{ event, setEvent }` to each step.

```
page.tsx
  └── WizardShell({ event, setEvent, step, setStep })
        ├── DetailsStep({ event, setEvent })
        ├── SubmissionStep({ event, setEvent })
        ├── JudgingStep({ event, setEvent })
        └── InviteStep({ event, setEvent })
```

---

## 3. Type Contracts

### WizardEventData (Single Source of Truth)

```typescript
// lib/types/wizard.ts

interface WizardEventData {
  // Basic Info
  event_name: string;
  event_date: string;              // YYYY-MM-DD
  location: string;
  location_type: "in-person" | "virtual" | "hybrid";
  slug: string;
  cover_image_url: string;
  cover_image_file?: File;         // For Supabase Storage upload

  // Content
  event_blurb: string;
  event_description: string;
  event_type: string;

  // Submission Window
  submission_time_start: string;   // ISO 8601
  submission_time_cutoff: string;  // ISO 8601
  timezone: string;

  // Capacity & Pricing
  participant_capacity: number;
  paid: boolean;
  stripe_price_id: string;

  // Schedule
  schedule: ScheduleDay[];

  // Content Sections
  faqs: FAQItem[];
  rules: RuleSection[];
  resources: Resource[];
  gallery: GalleryImage[];

  // Submission Form
  submission_fields: SubmissionField[];
  max_team_size: number;
  allow_multiple_tracks: boolean;

  // Tracks & Judging
  tracks: Track[];

  // Access & Invites
  organizer_emails: string[];
  visibility: "Draft" | "Private" | "Public";
}

interface ScheduleDay {
  date: string;
  events: ScheduleEvent[];
}

interface ScheduleEvent {
  id: string;
  name: string;
  time: string;
  description: string;
  guests?: string;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface RuleSection {
  id: string;
  title: string;
  items: string[];
}

interface Resource {
  id: string;
  name: string;
  link: string;
}

interface Track {
  client_id: string;               // "track-{index}-{slug}"
  name: string;
  description: string;
  label?: string;
  prizes: Prize[];
  criteria: Criterion[];
}

interface Prize {
  id: string;
  name: string;
  description: string;
  cover_image_url?: string;
}

interface Criterion {
  id: string;                      // "crit-{trackIdx}-{critIdx}"
  name: string;
  description: string;
  type: "numeric" | "multiplechoice";
  weight: number;
  min: number;
  max: number;
  options?: string[];
}
```

### API Payload Builder

At submit time, `WizardEventData` is converted to match `POST /api/events`:

```typescript
function buildApiPayload(event: WizardEventData): EventApiPayload {
  return {
    event: {
      event_name: event.event_name,
      event_date: event.event_date,
      location: event.location,
      slug: event.slug,
      // ... direct fields ...

      // Tracks: convert inline structure to API format
      tracks: event.tracks.map(t => ({
        client_id: t.client_id,
        name: t.name,
        description: t.description,
        scoring_criteria: t.criteria.length > 0 ? {
          name: t.name,
          criteria: t.criteria,
        } : undefined,
      })),

      // Prizes: flatten from tracks
      prizes: event.tracks.flatMap(t =>
        t.prizes.map(p => ({
          track_client_id: t.client_id,
          name: p.name,
          description: p.description,
        }))
      ),
    },
    organizerEmails: event.organizer_emails,
  };
}
```

### Step Component Interface

Every step follows the same contract:

```typescript
interface StepProps {
  event: WizardEventData;
  setEvent: React.Dispatch<React.SetStateAction<WizardEventData>>;
}
```

---

## 4. Phase 0 — Preparation

**Goal:** Set up shared infrastructure without touching the existing page.

### Tasks

| # | Task | Spec | Acceptance Criteria |
|---|---|---|---|
| 0.1 | Create `lib/types/wizard.ts` | Define `WizardEventData` and all sub-interfaces per Section 3 | Type compiles. All fields from both Event Scraper's `EventData` and MentorMates' current form state are covered. |
| 0.2 | Create `lib/tinyfish/client.ts` | Port from `event-scraper/src/tinyfish/client.ts`. No changes to logic — just move the file. | Imports resolve. TypeScript compiles. |
| 0.3 | Create `lib/scraper/goals.ts` | Port from `event-scraper/src/scraper/goals.ts`. | File exists, exports goal prompt string. |
| 0.4 | Create `lib/scraper/devpost.ts` | Port from `event-scraper/src/scraper/devpost.ts`. Update imports to use new `lib/tinyfish/client` path. | Scraper function exports correctly, imports resolve. |
| 0.5 | Create `app/api/scrape/route.ts` | Port from `event-scraper/app/api/scrape/route.ts`. Remove test fixture logic. Wire to `lib/scraper/`. Set `maxDuration = 300`. | `POST /api/scrape` with `{url}` body returns scraped JSON. Requires `TINYFISH_API_KEY` in env. |
| 0.6 | Add `TINYFISH_API_KEY` to `.env.local` | Copy from event-scraper's env. | Env var available at runtime. |
| 0.7 | Create `buildApiPayload()` utility | In `lib/types/wizard.ts` or `lib/utils/event-payload.ts`. Converts `WizardEventData` → API payload per Section 3. | Unit-testable function. Handles tracks/prizes flattening, cover image URL, all field mappings. |

### Tests (Phase 0)

```
[ ] wizard.ts types compile with no errors
[ ] buildApiPayload() correctly flattens tracks → tracks[] + prizes[]
[ ] buildApiPayload() maps all direct fields
[ ] /api/scrape returns valid JSON for a test URL (manual smoke test)
[ ] TinyFish client handles SSE stream correctly
```

---

## 5. Phase 1 — Wizard Shell + DetailsStep

**Goal:** Replace the tab-based page with a working wizard. Only Step 1 is functional; Steps 2-4 are placeholder.

### Tasks

| # | Task | Spec | Acceptance Criteria |
|---|---|---|---|
| 1.1 | Create `WizardShell.tsx` | Breadcrumb step nav (Details → Submission → Judging → Invite). Previous/Next buttons. URL import bar at top with scrape trigger. Progress indicator. | Step navigation works. URL bar triggers scrape. Current step renders correct component. |
| 1.2 | Create `DetailsStep.tsx` | Port from Event Scraper. Sub-sections selectable via chip/pill nav: Basic Info, Overview, Schedule, FAQs, Rules, Resources. Each section is an editor component. | All sub-sections render and edit correctly. |
| 1.3 | Create `BasicInfoEditor.tsx` | Event name, date picker, location input, location type toggle, slug editor (auto-derive from name), cover image upload (file → Supabase Storage + URL fallback). | All fields editable. Slug auto-generates. Image uploads to Supabase Storage. |
| 1.4 | Create `ContentEditor.tsx` | Blurb (short text), description (markdown textarea with preview toggle). | Markdown preview renders correctly. |
| 1.5 | Create `ScheduleEditor.tsx` | Multi-day schedule. Add/edit/remove days and events within days. Time, name, description, guests fields per event. | CRUD operations work. Dates sort correctly. |
| 1.6 | Create `FAQEditor.tsx` | Q&A pair list. Add/edit/remove. Inline editing. | CRUD works. Empty state shown when no FAQs. |
| 1.7 | Create `RulesEditor.tsx` | Rule sections with title + items list. Add/edit/remove sections and items. | CRUD works for both sections and items within sections. |
| 1.8 | Create `ResourcesEditor.tsx` | Name + URL pairs. Add/edit/remove. | CRUD works. URLs validated. |
| 1.9 | Rewrite `page.tsx` | ~200 lines. Auth check (Supabase session). Prefill from localStorage (`mentorMates-event-prefill`). Single `WizardEventData` state. Render `WizardShell`. Save/publish header with Draft, Private, Public options. | Auth redirect works. Prefill loads. Save creates event via `POST /api/events`. |
| 1.10 | Wire `applyScrapedData()` | When scrape completes, map scraped output to `WizardEventData` and update state. Handle partial data gracefully. | Scraping a URL populates all relevant fields in Step 1. |

### Tests (Phase 1)

```
[ ] Wizard renders with 4 step indicators, Step 1 active by default
[ ] Navigation: Next goes to Step 2, Previous goes back to Step 1
[ ] URL import bar: entering a URL and clicking Scrape shows loading state
[ ] applyScrapedData() populates event_name, event_date, location, schedule, FAQs, rules
[ ] BasicInfoEditor: editing name auto-updates slug
[ ] BasicInfoEditor: cover image file upload → Supabase Storage → URL in state
[ ] ScheduleEditor: add day → add event → edit event → delete event → delete day
[ ] FAQEditor: add → edit → delete FAQ items
[ ] RulesEditor: add section → add item → edit → delete
[ ] ResourcesEditor: add → edit → delete resources
[ ] ContentEditor: markdown preview renders headings, lists, links
[ ] Save Draft: POST /api/events with visibility=Draft → event created in DB
[ ] Publish Private: POST /api/events with visibility=Private → event created
[ ] Prefill from localStorage: navigate with prefill data → fields populated → localStorage cleared
[ ] Empty state: wizard loads clean with no prefill
```

---

## 6. Phase 2 — SubmissionStep

**Goal:** Wire Step 2 using the existing `components/events/submission/` module.

### Tasks

| # | Task | Spec | Acceptance Criteria |
|---|---|---|---|
| 2.1 | Create `SubmissionStep.tsx` | Thin wrapper. Bridges `WizardEventData.submission_fields` to existing `SubmissionStep` component's `{ fields, onChange }` interface. Add team settings below (max_team_size, allow_multiple_tracks). | Existing submission editor renders. Field changes persist in wizard state. |
| 2.2 | Verify type bridge | Ensure `WizardEventData.submission_fields` type matches what `SubmissionStep` expects. Use existing `apiFieldsToEditor()` / `fieldsToApiPayload()` converters if needed. | No type errors. Round-trip conversion preserves data. |

### Tests (Phase 2)

```
[ ] Step 2 renders the submission field editor
[ ] Add/remove/reorder fields persists in wizard state
[ ] Navigate away and back: fields preserved
[ ] Team settings (max_team_size, allow_multiple_tracks) editable
[ ] buildApiPayload() includes submission_fields correctly
[ ] Prefill data with submission_fields populates the editor
```

---

## 7. Phase 3 — JudgingStep

**Goal:** Port the track/criteria/prize editor as Step 3.

### Tasks

| # | Task | Spec | Acceptance Criteria |
|---|---|---|---|
| 3.1 | Create `JudgingStep.tsx` | Edit/Preview toggle wrapper. Renders `TrackEditor` in edit mode, `JudgingPreview` in preview mode. | Toggle works. Both modes render. |
| 3.2 | Create `TrackEditor.tsx` | Port from Event Scraper's `judging/TrackEditor.tsx`. Replace Heroicons → Lucide. Drop AI chat. Auto-generate `client_id` as `track-{index}-{slugified-name}`. Inline track CRUD: expand/collapse, add/edit criteria with weight/min/max/type, add/edit prizes. | Full track CRUD works. Criteria scoring editable. Prizes linkable. |
| 3.3 | Create `JudgingPreview.tsx` | Port from Event Scraper. Read-only view of tracks, criteria weights, and prizes. | Displays all tracks with criteria and prizes correctly. |
| 3.4 | Verify payload conversion | `buildApiPayload()` converts inline `Track[]` → separate `tracks[]` + `prizes[]` with `track_client_id` references. | Events created with tracks have correct `event_tracks` and `prizes` rows in DB. |

### Icon Mapping Reference (Heroicons → Lucide)

```
PlusIcon → Plus               TrashIcon → Trash2
PencilIcon → Pencil           XMarkIcon → X
CheckIcon → Check             ChevronUpIcon → ChevronUp
ChevronDownIcon → ChevronDown TrophyIcon → Trophy
TagIcon → Tag                 ScaleIcon → Scale
MapPinIcon → MapPin           CalendarIcon → Calendar
UsersIcon → Users             PhotoIcon → ImageIcon
ClockIcon → Clock             EyeIcon → Eye
SparklesIcon → Sparkles       DocumentIcon → FileText
```

### Tests (Phase 3)

```
[ ] Step 3 renders with edit/preview toggle
[ ] Add track → set name, description → track appears in list
[ ] Add criterion to track → set name, weight, min/max → criterion appears
[ ] Add prize to track → set name, description → prize appears
[ ] Edit track/criterion/prize inline → changes persist
[ ] Delete track/criterion/prize → removed from state
[ ] Preview mode: shows read-only summary of all tracks
[ ] buildApiPayload(): tracks[].scoring_criteria correctly structured
[ ] buildApiPayload(): prizes[] flattened with correct track_client_id
[ ] Scrape import populates tracks with criteria and prizes
[ ] Navigate away and back: tracks preserved
```

---

## 8. Phase 4 — InviteStep + Final Integration

**Goal:** Complete Step 4 and the end-to-end flow.

### Tasks

| # | Task | Spec | Acceptance Criteria |
|---|---|---|---|
| 4.1 | Create `InviteStep.tsx` | Sub-tabs: Share, Participants, Judges, Organizers. Share tab: generate event links + QR codes. Organizers tab: email input for adding organizer roles. | All sub-tabs render. QR code generates. Organizer emails persist. |
| 4.2 | Port access settings | Move role password management and visibility settings from the old Access tab into InviteStep's Organizers sub-tab. | Visibility toggle works. Role passwords editable. |
| 4.3 | Update `CreateEventModal` | Simplify to 2 options: "Create from scratch" → `/events/new`, "Import from Website" → `/events/new?url=...` (wizard URL bar auto-triggers scrape). Remove "Import from DevPost" as a separate option. | Modal shows 2 options. Import navigates with URL param. |
| 4.4 | Wire final submit | On Step 4: "Create Event" button calls `buildApiPayload()` → `POST /api/events`. Handle Draft / Private / Public publish modes. Show success → redirect to event page. | Event created end-to-end. Redirect works. |
| 4.5 | Wire prefill from URL param | If `/events/new?url=<hackathon-url>`, auto-trigger scrape on mount and populate wizard. | Navigating with URL param starts scrape and fills data. |

### Tests (Phase 4)

```
[ ] Step 4 Share tab: generates correct event URLs (overview, submit, judge)
[ ] Step 4 Share tab: QR code renders for event URL
[ ] Step 4 Organizers: add email → appears in organizer list
[ ] Step 4 Organizers: remove email → removed from list
[ ] CreateEventModal: "Create from scratch" → empty wizard
[ ] CreateEventModal: "Import from Website" → wizard with URL param → scrape starts
[ ] Full E2E: scrape URL → review 4 steps → save as Draft → event in DB with all data
[ ] Full E2E: create from scratch → fill all 4 steps → publish as Private → event in DB
[ ] Publish modes: Draft, Private, Public (admin only) all work
[ ] Redirect after create: goes to /events/{slug}/overview
[ ] organizerEmails sent in payload → organizer roles assigned
```

---

## 9. Phase 5 — Cleanup + Polish

**Goal:** Remove dead code, verify feature parity, deploy.

### Tasks

| # | Task | Spec | Acceptance Criteria |
|---|---|---|---|
| 5.1 | Delete old `page.tsx` | The original 4600-line file is fully replaced. | File removed. No imports reference it. |
| 5.2 | Delete old import routes | Remove `/api/devpost/import/route.ts` and `/api/events/import/devpost/route.ts` (MagicLoops-based). | Routes removed. No dead code. |
| 5.3 | Remove unused dependencies | If MagicLoops client code or unused packages remain, remove them. | `npm run build` passes. No unused imports. |
| 5.4 | Feature parity audit | Verify every field from the old form exists in the wizard. Checklist below. | All fields accounted for. |
| 5.5 | Vercel deployment check | Push to branch, verify preview deployment succeeds. Check `maxDuration` on scrape route. | Vercel build passes. Scrape endpoint works in preview. |

### Feature Parity Checklist

```
[ ] Event name, date, location, location type
[ ] Slug (auto-generate + manual edit)
[ ] Cover image (file upload to Supabase Storage + URL input)
[ ] Event blurb, description (markdown)
[ ] Event type
[ ] Submission window (start, cutoff, timezone)
[ ] Participant capacity
[ ] Paid/free toggle + Stripe price ID
[ ] Schedule (multi-day with events)
[ ] FAQs
[ ] Rules (sections with items)
[ ] Resources (name + link)
[ ] Gallery images
[ ] Submission form fields (WYSIWYG editor)
[ ] Team settings (max size, multi-track)
[ ] Tracks with scoring criteria
[ ] Prizes linked to tracks
[ ] Organizer email invites
[ ] Visibility (Draft / Private / Public)
[ ] Approval workflow (submit for approval)
[ ] Role passwords
[ ] Admin-only publish-as-public
```

---

## 10. Testing Strategy

### Layer 1: Type Safety

Every phase starts by verifying types compile. `WizardEventData` is the contract — if it compiles, the data flows correctly between steps.

```bash
npx tsc --noEmit
```

### Layer 2: Unit Tests (Payload Builders)

The most critical logic is `buildApiPayload()` — converting wizard state to API format. Test:

- Direct field mapping (name, date, location, etc.)
- Track → `tracks[]` with `scoring_criteria` conversion
- Prize flattening → `prizes[]` with `track_client_id`
- Empty/partial data handling (no tracks, no prizes, no criteria)
- `applyScrapedData()` correctly maps scraper output → `WizardEventData`

### Layer 3: Component Smoke Tests

Each editor component renders without crashing with default/empty data:

```bash
# If using a test runner (vitest, jest):
- WizardShell renders with 4 steps
- DetailsStep renders all sub-sections
- SubmissionStep renders field editor
- JudgingStep renders edit/preview toggle
- InviteStep renders share + invite tabs
```

### Layer 4: Integration Tests (Manual per Phase)

After each phase, manually verify:

1. **Fresh create:** Open `/events/new` → fill out current phase's step → save as Draft → check DB
2. **Import flow:** Open `/events/new?url=<test-url>` → verify scrape populates fields → save
3. **Prefill flow:** Set localStorage prefill → navigate to `/events/new` → verify fields populated
4. **Round-trip:** Create event → view event page → verify all data displays correctly

### Layer 5: End-to-End (Phase 4+)

Full flow regression after all steps are wired:

```
[ ] Create from scratch → 4 steps → Draft → verify in DB
[ ] Create from scratch → 4 steps → Publish Private → verify
[ ] Import from Website → 4 steps → Draft → verify all scraped data persisted
[ ] Prefill from AI → 4 steps → Draft → verify
[ ] Edit after create (if edit page exists) → verify changes saved
[ ] Mobile responsive check on each step
```

### Layer 6: Build + Deploy Verification

```bash
npm run build    # Must pass (no type errors, no missing imports)
npm run lint     # Must pass
# Push to branch → Vercel preview deploy → smoke test scrape endpoint
```

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Vercel timeout on scrape** | TinyFish needs 1-3 min. Hobby plan caps at 60s. | MentorMates is on Vercel Pro (300s max). Set `maxDuration = 300` on scrape route. |
| **Track/Prize data shape mismatch** | Wizard uses inline `Track.prizes[]`. API expects separate `prizes[]` with `track_client_id`. | `buildApiPayload()` handles conversion. Test thoroughly with multi-track scenarios. |
| **Icon migration (Heroicons → Lucide)** | Tedious but mechanical. ~20 icons to swap. | Use mapping table in Phase 3. Search-and-replace. |
| **InviteStep circular dependency** | Event Scraper's InviteStep imports editors from DetailsStep for an inline preview. | Skip the "Event Details" sub-tab in InviteStep. Use a simplified read-only summary instead. |
| **Cover image upload regression** | Current form uploads to Supabase Storage. Event Scraper only uses URL. | Port the existing upload logic from old page.tsx into BasicInfoEditor. |
| **Prefill format change** | CreateEventModal stores prefill in localStorage. New wizard reads a different shape. | Add a `convertPrefillToWizardData()` adapter. Keep backward compatibility during transition. |
| **Old page.tsx is 4600 lines** | Lots of logic to audit for feature parity. | Feature parity checklist (Phase 5). Don't delete old file until checklist passes. |

---

## 12. Reference: File Map

### Files to CREATE in MentorMates

```
lib/types/wizard.ts                              ← WizardEventData type + buildApiPayload()
lib/tinyfish/client.ts                           ← TinyFish SSE client (from event-scraper)
lib/scraper/goals.ts                             ← TinyFish extraction prompt (from event-scraper)
lib/scraper/devpost.ts                           ← Scraper orchestration (from event-scraper)
app/api/scrape/route.ts                          ← TinyFish scrape endpoint
app/events/new/components/WizardShell.tsx         ← Step nav + URL bar + header
app/events/new/components/DetailsStep.tsx         ← Step 1 wrapper
app/events/new/components/SubmissionStep.tsx      ← Step 2 wrapper
app/events/new/components/JudgingStep.tsx         ← Step 3 wrapper
app/events/new/components/InviteStep.tsx          ← Step 4 wrapper
app/events/new/components/editors/BasicInfoEditor.tsx
app/events/new/components/editors/ContentEditor.tsx
app/events/new/components/editors/ScheduleEditor.tsx
app/events/new/components/editors/FAQEditor.tsx
app/events/new/components/editors/RulesEditor.tsx
app/events/new/components/editors/ResourcesEditor.tsx
app/events/new/components/judging/TrackEditor.tsx
app/events/new/components/judging/JudgingPreview.tsx
```

### Files to MODIFY in MentorMates

```
app/events/new/page.tsx                          ← Rewrite from 4600 → ~200 lines
components/events/create-event-modal.tsx          ← Simplify to 2 options
.env.local                                       ← Add TINYFISH_API_KEY
```

### Files to DELETE in MentorMates (Phase 5)

```
app/api/devpost/import/route.ts                  ← Replaced by /api/scrape
app/api/events/import/devpost/route.ts           ← Replaced by /api/scrape
```

### Source Files in Event Scraper (Reference)

```
event-scraper/app/preview/page.tsx               ← Wizard shell pattern
event-scraper/app/preview/components/*.tsx        ← Step components to port
event-scraper/src/tinyfish/client.ts             ← TinyFish client to copy
event-scraper/src/scraper/devpost.ts             ← Scraper logic to copy
event-scraper/src/scraper/goals.ts               ← Goal prompt to copy
event-scraper/src/schema/validation.ts           ← Zod schemas (reference)
```
