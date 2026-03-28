# MentorMates — Agentic Platform Sprint

> **Goal:** Ship CC skill integrations for organizer event management and participant project submission by Monday 3/31.
> **Tracking:** [Notion Dev Tasks Tracker](https://www.notion.so/255ab088064e8095b931c005ceaafbbe) · [GitHub Issues](https://github.com/edumame/MentorMates/issues)

---

## P0: Ship by Monday 3/31

### 1. CC skill: organizer event management
- **GitHub:** [#598](https://github.com/edumame/MentorMates/issues/598)
- **Status:** Not started
- **Effort:** Large
- **Owner:** TBD
- **Scope:**
  - [ ] Design API endpoints for agent access (`app/api/agent/events/`)
  - [ ] Auth flow: user authenticates → API key/token issued
  - [ ] Accept/reject participants via API
  - [ ] Send info to judges via API
  - [ ] View/manage event details via API
  - [ ] Package as downloadable CC skill file
  - [ ] Skill installable via single prompt/command

### 2. CC skill: participant project submission
- **GitHub:** [#599](https://github.com/edumame/MentorMates/issues/599)
- **Status:** Not started
- **Effort:** Large
- **Owner:** TBD
- **Scope:**
  - [ ] Project CRUD via agent API (reuse `features/projects/api/`)
  - [ ] Manage project metadata (title, description, team, links)
  - [ ] View feedback and scores
  - [ ] Update project artifacts
  - [ ] Package as downloadable CC skill

### 3. Cap event creation + event modification flow
- **GitHub:** [#600](https://github.com/edumame/MentorMates/issues/600)
- **Status:** Not started
- **Effort:** Medium
- **Owner:** TBD
- **Scope:**
  - [ ] Event creation flow with validation
  - [ ] Cap max events per user (configurable)
  - [ ] Event modification (edit details, schedule)
  - [ ] Profile image upload for events/organizers
  - [ ] Event submission for review (approval workflow)
  - [ ] Research Luma API for reference

### 4. Deploy demo/dev database
- **GitHub:** [#601](https://github.com/edumame/MentorMates/issues/601)
- **Status:** Not started
- **Effort:** Medium
- **Owner:** TBD
- **Scope:**
  - [ ] Create separate Supabase project for demo/dev
  - [ ] Write seed script with realistic sample data
  - [ ] Environment variable switching (prod vs demo)
  - [ ] Verify all features work on demo DB

### 5. E2E tests for agent skills + event management
- **GitHub:** [#602](https://github.com/edumame/MentorMates/issues/602)
- **Status:** Not started
- **Effort:** Medium
- **Owner:** TBD
- **Scope:**
  - [ ] Unit tests for agent API endpoints
  - [ ] Integration tests against demo/dev DB
  - [ ] E2E tests for full skill flow (auth → install → manage)
  - [ ] Test accept/reject participant flow
  - [ ] Test project submission via skill
  - [ ] Validate on demo DB before prod migration

---

## P1: Near-term

### 6. Agent capability management (access control)
- **GitHub:** [#603](https://github.com/edumame/MentorMates/issues/603)
- **Status:** Not started
- **Effort:** Large
- **Scope:**
  - [ ] Control which events agent can access
  - [ ] Permission levels per skill (read-only, full management)
  - [ ] Dashboard for viewing/revoking agent access
  - [ ] Audit log for agent actions

---

## P2: Medium-term Vision

### 7. Insforge for per-project DB provisioning
- **GitHub:** [#604](https://github.com/edumame/MentorMates/issues/604)
- **Status:** Not started
- **Effort:** Small (research only)
- **Scope:**
  - [ ] Can Insforge provision new DB instances via API?
  - [ ] Cost model for per-project DBs
  - [ ] Lifecycle management (create on project start, archive after event)
  - [ ] Integration with existing Supabase setup

### 8. Agent-native submission platform (future)
- No issue yet — depends on #598, #599, #604 outcomes
- [ ] Agents as first-class citizens for project submission
- [ ] Context skill integrations for project metadata
- [ ] MentorMates design system formalization

---

## Non-MentorMates Tasks

| Task | Status |
|------|--------|
| Update Stanford Founders interview page | Not started |
| Submit for MLH speaker series | Not started |
| MLH compliance export for Jonathan Gottfried | Not started |

---

## Legacy PRD (Existing Backlog)

### Track System
- [ ] Support assigning winners per track

### Organizer Dashboard
- [ ] Display full list of participants
- [ ] Display all project submissions
- [ ] Show live judge scores per project
- [ ] Enable view of which projects are leading per track
- [ ] Export capability for submissions and scores
- [ ] Allow organizers to change submission times
- [ ] Display video links as embedded

### Submission System
- [ ] Submissions deadline enforcement for editing after submission
- [ ] Display selected track in dashboard
- [ ] Submission validation + stress test server calls

### Judging
- [ ] Score and reflection aggregation
- [ ] More flexible judging criteria for demo/pitch days
- [ ] Show individual judge scores
- [ ] Show judge-specific scoring patterns

### Project Assignment
- [ ] Assign projects to judges
- [ ] Display assigned projects to judges
- [ ] Add winner/placed column to project model
- [ ] Admin API route for tagging winners

### Winner Management
- [ ] Manual winner assignment by organizers
- [ ] Multiple winners per track
- [ ] Winner status in dashboard

### Analytics & Reporting
- [ ] Track-specific analytics
- [ ] Submission statistics
- [ ] Judging progress reports
- [ ] Export in multiple formats
- [ ] Judge participation reports

### Database & Infrastructure
- [ ] Clean up unused columns
- [ ] Fix auth callbacks and redirect URLs
- [ ] Link project leads/teammates to user_profiles
- [ ] Production monitoring
- [ ] Disaster recovery plan
- [ ] Better storage organization for projects
- [ ] Delete project materials on event deletion

---

*Last updated: 2026-03-27*
