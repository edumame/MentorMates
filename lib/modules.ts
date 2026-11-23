/**
 * The MentorMates module registry.
 *
 * MentorMates is a list of modules a founder community can turn on. This file
 * is the single source of truth for the public /modules page. Static for now;
 * becomes a table once a second community enables modules independently.
 */

export type ModuleStatus = "live" | "building" | "planned";

export interface MentorMatesModule {
  slug: string;
  name: string;
  /** One sentence, plain, no jargon. Shown on the card. */
  oneLiner: string;
  /** What the module actually does, 2-3 sentences. */
  description: string;
  status: ModuleStatus;
  /** Public URL when there is one. Internal-only modules omit it. */
  url?: string;
  /** Communities running it today. */
  communities: string[];
  /** Well-known tool this module is modeled after, when there is one. */
  modeledAfter?: string;
}

export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = {
  live: "Live",
  building: "In build",
  planned: "Planned",
};

export const mentorMatesModules: MentorMatesModule[] = [
  {
    slug: "events",
    name: "Events and Hackathons",
    oneLiner: "Run the whole event from one place.",
    description:
      "Registration and tickets, intake forms, project submissions, judging and prizes, mentor booking, and an agent API so organizers can manage the event from Claude Code instead of a dashboard.",
    status: "live",
    url: "/events",
    communities: ["Stanford Founders", "SEA Hacks", "DayDreamers"],
  },
  {
    slug: "demo-day-connect",
    name: "Demo Day Connect",
    oneLiner: "An investor-facing demo day with real signal.",
    description:
      "Investors get a practice fund and place checks, like and bookmark companies, and request decks. Founders see who is interested and can message them in the app.",
    status: "live",
    url: "https://connect.stanfordfounders-demoday.com",
    communities: ["Stanford Founders"],
  },
  {
    slug: "voxforma",
    name: "VoxForma",
    oneLiner: "Applications that give feedback back.",
    description:
      "The startup application flow, an optional AI interview or pitch practice, and a structured founder feedback report, so applicants learn something whether or not they are selected.",
    status: "live",
    url: "https://stanfordfounders-demoday.com",
    communities: ["Stanford Founders", "Founders Bridge"],
  },
  {
    slug: "founders-inbox",
    name: "Founders Inbox",
    oneLiner: "The back office for community officers.",
    description:
      "One shared inbox for SMS, WhatsApp and email intake, a board of requests with owners and statuses, and an internal calendar, docs and sheets. Private to each community's team.",
    status: "live",
    communities: ["Stanford Founders"],
  },
  {
    slug: "jobs",
    name: "Jobs",
    oneLiner: "Work at a startup in your community.",
    description:
      "Verified companies post roles, members apply with one profile, founders browse the candidate pool directly, and every company shows its reply rate so nobody is left waiting.",
    status: "building",
    communities: ["Stanford Founders"],
    modeledAfter: "YC Work at a Startup",
  },
  {
    slug: "cofounders",
    name: "Co-Founders",
    oneLiner: "Find the person to build with.",
    description:
      "Structured profiles with hard and soft preferences, invites that require a message, matches with a next-steps guide, and in-person matching nights.",
    status: "planned",
    communities: ["Stanford Founders"],
    modeledAfter: "YC Co-Founder Matching",
  },
  {
    slug: "forum",
    name: "Forum",
    oneLiner: "Ask the community, get answers within a day.",
    description:
      "Posts, comments, votes and tags, ranked the way Hacker News ranks them, with the reply notifications Hacker News never added. Members only, confidential by default.",
    status: "planned",
    communities: ["Stanford Founders"],
    modeledAfter: "Hacker News",
  },
  {
    slug: "directory",
    name: "Directory and Deals",
    oneLiner: "Know who is in the room.",
    description:
      "A searchable member and company directory with ask-me-about tags and open-to flags, partner perks with redemption tracking, and a weekly digest of who joined and what was asked.",
    status: "planned",
    communities: ["Stanford Founders"],
    modeledAfter: "YC Bookface",
  },
];
