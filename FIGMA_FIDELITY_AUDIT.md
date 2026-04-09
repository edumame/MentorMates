# Figma vs Codebase Fidelity Audit

**Figma File:** [MentorMates Product v1.0](https://www.figma.com/design/FL17jGfhEIy06FGIZBOZl7/MentorMates-Product)
**Repo:** `/Users/china/codeDev/MentorMates`
**Date:** 2026-03-15
**Auditor:** Claude Code

---

## Legend

- ✅ **Matches** — Implementation closely matches Figma design
- ⚠️ **Partial** — Implemented but with notable fidelity gaps
- ❌ **Missing** — Designed in Figma but not implemented or significantly different
- 🔄 **Diverged** — Implementation has evolved beyond the Figma design (code is ahead)

---

## P0: Homepage (Public Landing)

### Home • Desktop (Figma: `155:2989`)

**Code:** `app/page.tsx` → `LandingHero.tsx` + sub-components


| Element                              | Figma                                                   | Code                                                                                                          | Status | Notes                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navbar (public)                      | Top bar with logo, nav links, Login/Get Started buttons | `Navbar.tsx` - logo, Events, Host, Mentor, Discord, Resources, Login/Sign Up                                  | ⚠️     | Figma shows cleaner horizontal nav; code has dropdown menus for Resources. Figma has "Get started" CTA button; code has separate Login + Sign Up |
| Hero headline                        | "Your home for Hackathons" with blue italic accent      | Animated carousel cycling ["Hackathons", "AI Workshops", "Demo Days", "Pitch Days", "Prototypes", "Builders"] | 🔄     | Code is more dynamic — animates through multiple words. Figma is static "Hackathons" only                                                        |
| Hero CTA                             | Single "Get started" blue button                        | "Get started" button with ArrowRight icon                                                                     | ✅      | Matches well                                                                                                                                     |
| Logo carousel                        | Row of partner logos (Tencent, Goodcities, etc.)        | `LogoCarousel.tsx` - scrolling marquee                                                                        | ✅      | Code uses animated marquee vs static row in Figma                                                                                                |
| "How MentorMates Works" section      | 3-step (Learn, Create, Grow) with illustrations         | `Work.tsx` component                                                                                          | ⚠️     | General structure matches but illustrations/icons differ. Code may use different visual assets                                                   |
| "Join the Innovation Revolution" CTA | Blue gradient banner                                    | `CTAJoin.tsx`                                                                                                 | ⚠️     | Present but styling details may differ                                                                                                           |
| Featured Events carousel             | 4 event cards in a row                                  | `Featured.tsx` component                                                                                      | ⚠️     | Code renders featured events but card layout differs from Figma's exact card design                                                              |
| Impact stats section                 | "95% ..., 200+, 10+, 1000+" stats grid                  | `Impact.tsx` component                                                                                        | ✅      | Stats section present with similar layout                                                                                                        |
| "Build your next event" section      | Feature list with checkmarks                            | `Build.tsx` component                                                                                         | ⚠️     | Structure present but exact layout/styling may differ                                                                                            |
| Customer testimonials                | 3 testimonial cards with stars                          | `Customer.tsx` + `testimonial-carousel.tsx`                                                                   | ⚠️     | Code uses carousel; Figma shows static 3-column grid                                                                                             |
| Footer                               | Newsletter + link columns + social icons                | `Footer.tsx` - Substack form, link grid, social icons                                                         | ✅      | Good match — newsletter, links, socials all present                                                                                              |


### Home • Mobile (Figma: `426:16667`)

**Code:** Same components with responsive breakpoints


| Element              | Status | Notes                                   |
| -------------------- | ------ | --------------------------------------- |
| Mobile nav hamburger | ✅      | Code has hamburger menu toggle          |
| Stacked hero         | ⚠️     | Responsive but exact spacing may differ |
| Stacked sections     | ✅      | Components stack vertically on mobile   |


---

## P0: Static Pages

### About Us (Figma: `11:10011` / `11:9598`)

**Code:** `app/(static)/about/page.tsx` → `components/about/`


| Element          | Status | Notes                                                             |
| ---------------- | ------ | ----------------------------------------------------------------- |
| Hero section     | ⚠️     | About hero exists but may not match Figma's exact layout          |
| Team grid        | ⚠️     | `Team.tsx` renders team members; Figma shows specific card design |
| Mission section  | ⚠️     | `Mission.tsx` exists; layout details may differ                   |
| Event highlights | ⚠️     | `EventHighlights.tsx` present                                     |


### Blog (Figma: `11:9275` / `11:8908`)

**Code:** `app/(static)/blog/page.tsx` → `components/blog/`


| Element           | Status | Notes                                                                                              |
| ----------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Blog listing page | ⚠️     | `BlogPage.tsx` + `BlogCard.tsx` exist; only 3 hardcoded articles                                   |
| Blog detail page  | ⚠️     | Individual article components (1.tsx, 2.tsx, 3.tsx); Figma shows richer detail layout with sidebar |
| Blog card design  | ⚠️     | Cards exist but Figma shows image + tags + author avatar; code may be simpler                      |


### Research (Figma: `426:16751` / `428:15748`)

**Code:** `app/(static)/research/page.tsx` → `components/research/Research.tsx`


| Element       | Status | Notes                                       |
| ------------- | ------ | ------------------------------------------- |
| Research page | ⚠️     | Component exists; fidelity to Figma unclear |


### Legal Pages (Figma: `432:18633` / `432:19004`)

**Code:** `app/(static)/privacy/page.tsx`, `app/(static)/terms/page.tsx`


| Element             | Status | Notes                           |
| ------------------- | ------ | ------------------------------- |
| Privacy/Terms pages | ✅      | Pages exist with static content |


---

## P1: Authenticated Webapp

### Auth: Sign Up / Login (Figma: `38:8960`, `680:8415`, `43:2858`, `680:8552`)

**Code:** `app/(auth)/login/page.tsx`, `app/select-role/page.tsx`


| Element      | Status | Notes                                                                         |
| ------------ | ------ | ----------------------------------------------------------------------------- |
| Login form   | ⚠️     | Login page exists; Figma shows specific field layout and social login options |
| Sign up form | ⚠️     | Figma shows multi-step signup; code routes through select-role                |
| Split layout | ⚠️     | Figma shows left form + right testimonial panel; code layout unclear          |


### Dashboard / Home (Figma: `41:3174`)

**Code:** `app/HomePageClient.tsx` → `components/heroes/Hero.tsx` + `SidebarLayout.tsx`


| Element                        | Figma                                                                                          | Code                                   | Status | Notes                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Left sidebar                   | Home, Event, Learn, Project, Feedback (with count badge)                                       | `SideNav.tsx` - similar items          | ⚠️     | Figma shows clean icon+label sidebar with blue highlight on active. Code uses SideNav but exact styling may differ                             |
| Welcome greeting               | "Welcome, Chinat!" with stat cards (Events attended: 4, My projects: 4, Feedback received: 24) | `Hero.tsx` shows personalized greeting | ⚠️     | Figma has action cards ("Join an event", "Create a project") + stat cards in a grid. Code has gradient text hero — likely **different layout** |
| Quick action cards             | "Join an event" + "Create a project" blue-tinted cards                                         | Not clearly implemented as cards       | ❌      | Figma shows these as distinct clickable cards; code may handle differently                                                                     |
| "Navigate roles" section       | 4 video cards (Participant, Mentor, Judge, Organizer) with play buttons                        | Not clearly present in code            | ❌      | Figma shows tutorial video cards; code doesn't seem to have this section                                                                       |
| "My events" section            | 3 event cards with Upcoming/Past toggle                                                        | `MyEvents.tsx` component               | ⚠️     | Component exists but Figma shows specific card design with "Check in" / "Manage" / "Going" buttons. Code card buttons may differ               |
| Notification bell              | Bell icon with badge count (3)                                                                 | Notification system exists             | ⚠️     | Figma shows dropdown popover with notification items; code implementation unclear                                                              |
| Support + Profile footer links | Bottom of sidebar                                                                              | SideNav bottom items                   | ⚠️     | Present but styling may differ                                                                                                                 |


### Events Listing (Figma: `468:16098`)

**Code:** `app/events/page.tsx` → `components/events/events-list.tsx`


| Element               | Figma                                                           | Code                              | Status | Notes                                                                                                                               |
| --------------------- | --------------------------------------------------------------- | --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Page title "Events"   | Left-aligned with count                                         | Present                           | ✅      |                                                                                                                                     |
| Search bar            | "Search by event or host title" with search icon                | `EventSearchInput` component      | ✅      |                                                                                                                                     |
| Sort dropdown         | "Sort by" with chevron                                          | Present in events list            | ⚠️     | May differ in exact styling                                                                                                         |
| "Create event" button | Blue rounded button, top right                                  | Create event modal trigger        | ✅      |                                                                                                                                     |
| Event card grid       | 3-column grid of event cards                                    | `events-list.tsx` with event-card | ⚠️     | Grid layout present; individual card design details below                                                                           |
| Event card            | Image + date badge + type tags + title + location + description | `event-card.tsx`                  | ⚠️     | Structure matches but Figma shows specific aspect ratio (335:223), date badge positioning, and tag styling that may differ slightly |


### Event Detail Page / Overview (Figma: `1145:8978`)

**Code:** `app/events/[id]/overview/page.tsx` → `event-page-content.tsx` + `event-page-header.tsx`


| Element                    | Figma                                                             | Code                                             | Status | Notes                                         |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ | ------ | --------------------------------------------- |
| Cover image banner         | Full-width with type/status badges overlaid                       | `event-page-header.tsx` - 200-224px height cover | ✅      | Good match                                    |
| Event title + description  | Left-aligned under cover                                          | Present in header                                | ✅      |                                               |
| "Join" CTA button          | Blue button, right side                                           | Join event button                                | ✅      |                                               |
| Date + Location            | Calendar + pin icons                                              | Present with icons                               | ✅      |                                               |
| Organizer avatar + name    | "HerWorkspace" with avatar                                        | Present in header                                | ⚠️     | May not show org avatar exactly as Figma      |
| Tab navigation             | Overview, Schedule, Participants (3), Projects (3), FAQs, Gallery | `event-page-tabs.tsx` - same tabs with counts    | ✅      | Good match; active underline style            |
| Introduction section       | Heading + body text                                               | Markdown rendered content                        | ✅      |                                               |
| "Important links" sidebar  | DevPost, Mentor Support, Hardware Lab buttons                     | `event-page-sidebar.tsx` - resource buttons      | ✅      | Good match                                    |
| "Share this event" section | Link, QR, LinkedIn, X, Facebook icons                             | Present in sidebar                               | ⚠️     | QR code button has no click handler           |
| Judges section             | 2-column grid of judge avatars + titles                           | Judges rendered in content                       | ⚠️     | Layout may differ from Figma's 2-col          |
| Rules section              | 2-column cards (General Rules + Submission Requirements)          | Rules rendered in content                        | ✅      | 2-column layout present                       |
| Prizes & Tracks            | Collapsible track sections with prize details                     | Track/prize cards                                | ⚠️     | Structure present but card styling may differ |


### Event Detail / Participants Tab (Figma: `1061:9618`)

**Code:** `components/events/participants-content.tsx`


| Element                 | Figma                                                            | Code                                | Status | Notes                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Participant rows        | Avatar + Name + subtitle + "# Projects" + Follow/Unfollow button | Avatar + name + "Participant" label | ⚠️     | Figma shows richer participant info (champion status, project count) and Follow buttons. Code shows simpler rows without Follow functionality |
| Follow/Unfollow buttons | Blue rounded buttons per participant                             | ❌ Not implemented                   | ❌      | **Major gap** — Figma designs Follow functionality that doesn't exist in code                                                                 |
| Participant subtitle    | "All-time champion • 3 Projects"                                 | Just "Participant" label            | ⚠️     | Code shows simpler role label                                                                                                                 |


### Event Detail / Schedule Tab (Figma: `1390:12846`)

**Code:** `components/events/schedule-content.tsx`


| Element               | Figma                                           | Code                          | Status | Notes                                                                                                          |
| --------------------- | ----------------------------------------------- | ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Day headers           | "Friday 09 Sep" with collapse chevron           | Day title with ChevronUp/Down | ✅      |                                                                                                                |
| Time slots            | "12-1 pm" left-aligned                          | Time displayed per event      | ✅      |                                                                                                                |
| Event name            | Bold text (e.g., "CXO Fireside Chat")           | Event name displayed          | ✅      |                                                                                                                |
| Speaker/guest avatars | Avatar + Name + Role badge + Title              | Avatar with role badges       | ⚠️     | Figma shows 3-column guest layout with role badges (Guest, Moderator, Facilitator). Code may show simpler list |
| Role badges           | "Guest", "Moderator", "Facilitator" pill badges | Role badges present           | ⚠️     | Present but exact badge styling may differ                                                                     |


### Event Detail / Projects Tab (Figma: `1061:10753`)

**Code:** `components/events/gallery-content.tsx` (confusingly named)


| Element       | Figma                                                                | Code                   | Status | Notes                                                                                                                                  |
| ------------- | -------------------------------------------------------------------- | ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Search bar    | "Search projects by name or team members"                            | EventSearchInput       | ✅      |                                                                                                                                        |
| Project cards | Image + title + description + date + likes + comments + team avatars | ProjectBoard component | ⚠️     | Card structure exists but Figma shows specific card with like count (36), comment count (2), date, and team avatar row that may differ |
| 3-column grid | Cards in 3 columns                                                   | Grid layout            | ✅      |                                                                                                                                        |


### Event Detail / FAQs Tab (Figma: `1061:11853`)

**Code:** `components/events/faq-content.tsx`


| Element                         | Figma                                   | Code                          | Status | Notes                  |
| ------------------------------- | --------------------------------------- | ----------------------------- | ------ | ---------------------- |
| FAQ accordion                   | Question + expand/collapse with chevron | Accordion with ChevronUp/Down | ✅      | Good match             |
| "Still have questions?" section | With Contact button                     | Present with mailto link      | ✅      |                        |
| Default FAQs                    | 5 sample questions shown                | 8 default FAQs in code        | 🔄     | Code has more defaults |


### Event Detail / Gallery Tab (Figma: `1061:12391`)

**Code:** `components/events/gallery-content.tsx` (see note above)


| Element    | Figma                                           | Code                                                          | Status | Notes                                                                                                   |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| Photo grid | 4-column image grid with placeholder thumbnails | Gallery tab is commented out in event-page-tabs.tsx (line 55) | ❌      | **Gallery tab is disabled/commented out in code**. Figma shows full photo gallery grid. Not implemented |


### Event Detail / Pricing Modal (Figma: `1740:18978`)

**Code:** `components/events/pricing-tier-selector.tsx`


| Element                           | Figma                       | Code                                                      | Status | Notes      |
| --------------------------------- | --------------------------- | --------------------------------------------------------- | ------ | ---------- |
| Modal title "Select pricing tier" | With description            | Present                                                   | ✅      |            |
| Tier cards                        | Name + "Until" date + Price | Card with name, description, price, date, quantity badges | ✅      | Good match |
| "Unavailable" badge               | Red badge on expired tier   | Red badge with opacity reduction                          | ✅      |            |
| "Continue to payment" button      | Blue with ticket icon       | Present with Ticket icon                                  | ✅      |            |
| Selected state                    | Blue ring/highlight         | ring-2 ring-blue-500                                      | ✅      |            |


### Event Public Page (Figma: `1284:14855`)

**Code:** Public event page accessible without auth


| Element                   | Figma                                                                                                            | Code                       | Status | Notes                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- | ------ | ----------------------------------------- |
| Public navbar             | Different from auth navbar — has Projects, Host, Become a mentor, Join community, Resources, Log in, Get started | Public Navbar.tsx          | ⚠️     | Figma shows different nav items than code |
| Full overview with footer | Footer visible                                                                                                   | Footer conditionally shown | ✅      |                                           |


---

## P1: Projects

### Project Listing Page (Figma: `1187:9448`)

**Code:** `app/projects/page.tsx` → `features/projects/my-project-section.tsx`


| Element                    | Figma                                                                                                          | Code                   | Status | Notes                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| "Project" title with count | "Project 3"                                                                                                    | Page title present     | ✅      |                                                                                                                                 |
| Search bar                 | "Search by project name or team"                                                                               | Search input present   | ✅      |                                                                                                                                 |
| Filter tabs                | All / Public / Mine                                                                                            | Filter tabs            | ⚠️     | Code may have different filter options                                                                                          |
| "Create a project" button  | Blue rounded button                                                                                            | Create button          | ✅      |                                                                                                                                 |
| Project cards              | Gradient image + Draft/Owner badges + title + description + date + likes + comments + team avatars + more menu | Project card component | ⚠️     | Figma cards show specific gradient backgrounds (pink-blue), status badges, and three-dot menu. Code cards may differ in styling |


### Project Detail Page (Figma: `1161:9341`)

**Code:** `app/projects/[id]/page.tsx`


| Element                                     | Figma                                           | Code                 | Status | Notes                             |
| ------------------------------------------- | ----------------------------------------------- | -------------------- | ------ | --------------------------------- |
| Header: Status + date + member count        | "Draft" + "Created: July 1, 2023" + "2 members" | Present              | ⚠️     | Layout alignment may differ       |
| Edit / Like / Give feedback buttons         | Top right action bar                            | Present              | ✅      |                                   |
| Project title                               | Large heading                                   | Present              | ✅      |                                   |
| Project description                         | Subtitle text                                   | Present              | ✅      |                                   |
| "View Live Project" + "Watch Video" buttons | Green CTA + YouTube button                      | Present              | ⚠️     | Colors may differ                 |
| Cover image                                 | Right-aligned large image                       | Present              | ✅      |                                   |
| Tabs: Overview / Tracks / Team / Feedback   | Tab navigation                                  | Present              | ⚠️     | Code may have different tab names |
| "Meet the team" sidebar                     | Avatar + name + role + school                   | Team sidebar         | ⚠️     | Sidebar placement may differ      |
| "Submitted to" event card                   | Mini event card in sidebar                      | Event card reference | ⚠️     | May not match exact Figma layout  |
| "Additional materials" section              | Pitch deck link                                 | Materials section    | ⚠️     |                                   |
| "Share this project" icons                  | Link, QR, LinkedIn, X, Facebook                 | Share section        | ⚠️     | Similar to event share            |
| Rich content area                           | Markdown body with images + captions            | Markdown rendering   | ✅      |                                   |


### Project Team Page (Figma: `1187:11577`)

**Code:** Project detail with Team tab


| Element          | Status | Notes                                               |
| ---------------- | ------ | --------------------------------------------------- |
| Team member list | ⚠️     | Implementation exists but layout details may differ |
| Empty state      | ⚠️     | Figma shows empty team state (Figma: `1187:12517`)  |


### Project QR Code Page (Figma: `1284:11926` / `1187:13971`)

**Code:** `features/projects/project-dashboard/QRCodeSection.tsx`


| Element         | Status | Notes                       |
| --------------- | ------ | --------------------------- |
| QR code display | ⚠️     | QR section component exists |


### Judge Scoring View (Figma: `1228:28604`)

**Code:** `features/user/judge/index.tsx`


| Element                              | Figma                                                                        | Code                                  | Status | Notes                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------- | ------ | ------------------------------------------------------ |
| "Judge scoring" tab                  | 5th tab on project page                                                      | Present as judge dashboard            | ⚠️     | Code renders as separate dashboard, not as project tab |
| Track selector dropdown              | "Best AI Build"                                                              | Track selection present               | ✅      |                                                        |
| Scoring sliders                      | Technical implementation, AI integration, Originality, Usability with scores | DefaultScoring component with sliders | ✅      | Good functional match                                  |
| "Why are you seeing this?" info card | Blue info card explaining judge access                                       | May not be present                    | ⚠️     |                                                        |
| Feedback textarea                    | "Long description or markdown"                                               | Feedback input present                | ✅      |                                                        |
| Submit score button                  | Blue full-width                                                              | Submit button present                 | ✅      |                                                        |


---

## P1: Feedback

### Feedback Listing (Figma: `1208:22634`)

**Code:** `app/feedback/page.tsx`


| Element                          | Figma                                                              | Code                           | Status | Notes                                           |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------ | ------ | ----------------------------------------------- |
| "Feedback" title with count (24) | Left-aligned                                                       | Present with unread count      | ✅      |                                                 |
| "Mark all 24 as read" button     | Top right                                                          | Mark all as read button        | ✅      |                                                 |
| Table columns                    | Send from, Project Name, Message, Date, Action (View/Mark as read) | Same columns with fixed widths | ✅      | Good match                                      |
| Sender with role badge           | Avatar + name + "Mentor" badge                                     | Avatar + sender info           | ⚠️     | Figma shows role badges; code may not show role |
| Pagination                       | Prev/Next + page numbers                                           | Pagination controls            | ✅      |                                                 |


### Give Feedback Dialog (Figma: `1187:18941`)

**Code:** `features/projects/FeedbackForm.tsx` / `GiveFeedbackDialog.tsx`


| Element                           | Figma                                                                       | Code                               | Status | Notes                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------- | ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| Split modal                       | Left: textarea + "Enhance with AI" button. Right: Writing Tips (3 numbered) | Feedback modal with similar layout | ⚠️     | Code has "Enhance with AI" button but no handler. Right panel has gradient background with tips |
| "Improve feedback with AI" button | Blue full-width button at bottom                                            | "Enhance with AI" link present     | ⚠️     | Button exists but functionality may be incomplete                                               |


---

## P1: Learn

### Learn Page (Figma: `1061:12808`)

**Code:** `app/learn/page.tsx` → `components/heroes/components/LearnLayout.tsx`


| Element             | Figma                                                                        | Code            | Status | Notes                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| "Learn" title       | Top left                                                                     | Present         | ✅      |                                                                                                                    |
| All / Bookmark tabs | Top right                                                                    | Present         | ⚠️     | Code may have different tab implementation                                                                         |
| Lesson cards        | Image + play button overlay + title + description + duration + bookmark icon | Card components | ⚠️     | Cards exist but exact Figma card design (play button overlay, bookmark icon, duration badge) may differ in styling |
| 3-column grid       | Cards in grid                                                                | Grid layout     | ✅      |                                                                                                                    |


---

## P1: Notifications

### Notification Popover (Figma: `1208:21711`)

**Code:** Notification system


| Element                    | Figma                                                                  | Code                      | Status | Notes                                      |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------- | ------ | ------------------------------------------ |
| Bell icon with count badge | "3" badge on bell                                                      | Notification icon present | ⚠️     |                                            |
| Dropdown popover           | "Notification 3" header + event notification item + "Mark all as read" | Notification system       | ⚠️     | Exact popover design may differ from Figma |


---

## P1: Onboarding

### Onboarding Flow (Figma: `1228:28392` through `1269:12862`)

**Code:** `app/onboarding/page.tsx`


| Element             | Figma                                                      | Code                                        | Status | Notes                                                     |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------- | ------ | --------------------------------------------------------- |
| Step progress bar   | Blue progress indicator "Step 1/5"                         | Progress bar with percentage + step counter | ✅      | Code has 6 steps vs Figma's 5                             |
| Split layout        | Left: form. Right: testimonial with blue background        | Grid lg:grid-cols-2                         | ✅      | Good match                                                |
| Radio options       | Styled radio buttons (Beginner/Intermediate/Advanced)      | Radio group with blue selected state        | ✅      |                                                           |
| Testimonial panel   | Stars + quote + avatar + name/title + logo                 | Testimonial carousel                        | ✅      |                                                           |
| Skip / Next buttons | Bottom of form                                             | Back / Continue buttons                     | ⚠️     | Figma says "Skip" + "Next"; code says "Back" + "Continue" |
| Platform role cards | Icon + title cards (participant, mentor, judge, organizer) | Role cards with icons                       | ✅      |                                                           |


---

## P2: Profile

### View Profile (Figma: `1187:10435` section)

**Code:** `app/profile/[userId]/page.tsx`


| Element        | Figma                            | Code                            | Status | Notes                                                             |
| -------------- | -------------------------------- | ------------------------------- | ------ | ----------------------------------------------------------------- |
| Banner image   | Full-width gradient/image banner | Banner present                  | ⚠️     | Figma shows artistic "BENDING RHYTHMS" banner; code allows upload |
| Avatar         | Circular profile photo           | Avatar with camera upload icon  | ✅      |                                                                   |
| User info      | Name + bio + social links        | Name, bio, social links present | ⚠️     | Layout details may differ                                         |
| Project cards  | User's projects displayed        | Project section                 | ⚠️     |                                                                   |
| Tab navigation | Profile tabs                     | Tabs present                    | ⚠️     |                                                                   |


### Edit Profile (Figma: `1187:10435` section - Edit)

**Code:** Same page with edit mode


| Element              | Status | Notes                             |
| -------------------- | ------ | --------------------------------- |
| Form fields          | ⚠️     | Edit mode exists with form inputs |
| Social links editing | ⚠️     | Modal for social link editing     |
| Banner/avatar upload | ⚠️     | Upload functionality present      |


---

## P1: Organizer Dashboard

### Organizer Dashboard (Figma: `1452:12458` section)

**Code:** `features/user/OrganizerDashboardShell.tsx` + `components/events/organizer-edit-overview.tsx`


| Element                | Figma                                    | Code                                      | Status | Notes                                                             |
| ---------------------- | ---------------------------------------- | ----------------------------------------- | ------ | ----------------------------------------------------------------- |
| Event detail editing   | Multi-tab editor                         | 12+ tab organizer dashboard               | 🔄     | **Code is ahead of Figma** — more tabs and features than designed |
| Basic info form        | Event name, description, dates, location | `BasicInfoTab.tsx` - comprehensive form   | 🔄     | Code has more fields than Figma shows                             |
| Content editing        | Markdown editor + lessons                | `ContentTab.tsx` with edit/preview        | ✅      |                                                                   |
| Schedule editing       | Day/event nested editor                  | `ScheduleTab.tsx` + `schedule-editor.tsx` | ✅      | Well-implemented                                                  |
| Pricing management     | Tier cards with Stripe IDs               | `PricingTab.tsx`                          | ⚠️     | Stripe integration incomplete                                     |
| Prize management       | Track-based prizes with winners          | `PrizesTab.tsx`                           | ⚠️     |                                                                   |
| Participant management | Participant table/grid                   | Various participant components            | ⚠️     |                                                                   |
| Email dashboard        | Send emails to participants              | `EmailDashboard.tsx`                      | ⚠️     | Basic — no bulk send, no templates                                |
| Gallery editing        | Photo upload/management                  | Gallery section "coming soon"             | ❌      | **Not implemented**                                               |
| Create event modal     | 3 paths: Scratch, AI, DevPost            | `create-event-modal.tsx`                  | ✅      | Well-designed modal                                               |


---

## Style Guide / Design System

### Figma Style Guide (Figma: `49:8770`)

**Code:** `components/ui/` (48 shadcn/UI components) + `tailwind.config.ts`


| Element       | Status | Notes                                                                                                                                            |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Color palette | ⚠️     | Figma uses specific blues (#4B89EF, DBEAFE); code uses Tailwind blues + custom colors. Some hardcoded hex values in code don't use design tokens |
| Typography    | ⚠️     | Code uses Geist font family; Figma may specify different font weights/sizes. Code has hardcoded px sizes (22px, 16px) instead of Tailwind scale  |
| Spacing       | ⚠️     | Generally consistent via Tailwind but some hardcoded values                                                                                      |
| Border radius | ✅      | Consistent use of rounded-xl, rounded-lg                                                                                                         |
| Shadow system | ⚠️     | Mix of shadow-sm, shadow-lg, and custom box-shadows                                                                                              |
| Icon library  | ⚠️     | **Inconsistency** — code mixes Lucide React, Material UI icons, and inline SVGs. Figma likely uses one icon set                                  |


---

## Summary: Critical Fidelity Gaps

### ❌ Not Implemented (Designed in Figma)

1. **Gallery tab** — Commented out in event-page-tabs.tsx. Figma shows full photo grid
2. **Follow/Unfollow on Participants tab** — Figma shows Follow buttons per participant; not in code
3. **Dashboard quick action cards** — "Join an event" + "Create a project" cards not implemented as designed
4. **"Navigate roles" video tutorial section** — 4 tutorial video cards on dashboard not present
5. **Gallery editing (organizer)** — Marked "coming soon" in organizer dashboard

### ⚠️ Significant Fidelity Gaps

1. **Dashboard layout** — Code shows gradient text hero; Figma shows stat cards + action cards + event list. **Major layout divergence**
2. **Participant info richness** — Figma shows "All-time champion • 3 Projects" + Follow; code shows just "Participant"
3. **Event card date badge** — Figma shows prominent white date badge overlay (day + month); code may render differently
4. **Notification popover** — Figma designs specific dropdown; code implementation unclear
5. **Sidebar nav styling** — Figma shows icon+label with blue active highlight; code SideNav may differ
6. **Project card badges** — Figma shows Draft/Owner badges with specific positioning; code may differ
7. **"Enhance with AI" in feedback** — Button exists but has no handler
8. **QR code share button** — Rendered but no click handler
9. **Onboarding step count** — Figma has 5 steps; code has 6
10. **Button labels** — Figma: "Skip"/"Next"; Code: "Back"/"Continue" in onboarding
11. **Admin dashboard** — Marked with TODO: "fix this page" — incomplete implementation

### 🔄 Code Ahead of Figma

1. **Organizer dashboard** — Code has 12+ tabs vs Figma's simpler layout
2. **Hero animation** — Code animates through multiple words; Figma is static
3. **FAQ defaults** — Code has 8 vs Figma's 5
4. **Event tools** — Code has Brainstormer, Whiteboard, Website Builder (no Figma designs)
5. **AI features** — AI Vibe Guide, AI Vibe Masterclass pages (no Figma designs)
6. **Voting system** — Code has full voting with results panel (limited Figma coverage)
7. **Sponsorships tab** — In code but commented-out in Figma header link

### Icon Inconsistency

- Code mixes **3 icon libraries**: Lucide React, Material UI (@mui/icons-material), and inline SVGs
- Figma likely uses a single consistent icon set
- Recommendation: Standardize on Lucide React (already most-used) and remove MUI icon dependency

### Color Inconsistency

- Several hardcoded hex colors in code: `#4B89EF`, `#DBEAFE`, `#fafbff`, `#f6f7ff`, `rgba(0,0,0,0.15)`
- Should be extracted to Tailwind theme tokens matching Figma design tokens
- Border color `rgba(0,0,0,0.15)` used consistently but not as a Tailwind utility

---

## Priority Recommendations

### P0 — Must Fix (User-Facing Impact)

1. Implement Gallery tab (or remove from tab navigation)
2. Fix dashboard layout to match Figma stat cards + action cards design
3. Add participant info richness (project count, champion status)
4. Wire up "Enhance with AI" feedback button or remove
5. Fix QR code share button handler

### P1 — Should Fix (Design Polish)

1. Standardize icon library (Lucide React only)
2. Extract hardcoded colors to Tailwind theme
3. Match onboarding step count and button labels to Figma
4. Implement notification popover design
5. Add Follow/Unfollow to participants tab

### P2 — Nice to Have

1. Add "Navigate roles" tutorial section to dashboard
2. Polish event card date badge to match Figma exactly
3. Add gallery editing to organizer dashboard
4. Complete admin dashboard (remove TODO)
5. Align sidebar nav styling to Figma spec

