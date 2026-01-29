/**
 * Centralized source of truth for MentorMates tutorial videos.
 *
 * Why this file exists:
 * - These links used to be hardcoded in multiple places.
 * - When a URL changes, we only want to update it ONE time.
 *
 * Later:
 * - We can make `/api/tutorials` sync with Notion and still keep the rest of the app
 *   pointing at this single shape.
 */
export type VideoCategory = "role" | "notion";

export const VIDEO_SOURCES = {
  participant: {
    title: "Participant Guide",
    description:
      "Submit projects, share ideas, and get real feedback from mentors and judges.",
    url: "https://youtu.be/GMHO4vdLgD0",
    category: "role",
  },
  mentor: {
    title: "Mentor Guide",
    description:
      "Support participants with actionable, encouraging feedback that helps them grow.",
    url: "https://youtu.be/mAm-LnMK5dA",
    category: "role",
  },
  judge: {
    title: "Judge Guide",
    description: "Review projects, score fairly, and provide constructive feedback.",
    url: "https://youtu.be/o1iCt7qE5UY",
    category: "role",
  },
  organizer: {
    title: "Organizer Guide",
    description:
      "Manage events: set up submissions, assign mentors/judges, and configure parameters.",
    url: "https://youtu.be/DFGjGusKtdo",
    category: "role",
  },

  // These are currently referenced from a Notion “Tutorial Videos” database.
  // We keep them here so the app doesn’t scatter these URLs across the codebase.
  participantsGuideNotion: {
    title: "Participants Guide (Notion)",
    description: "A Notion-based walkthrough for participants.",
    url: "https://youtu.be/RMcgFz-R2n4",
    category: "notion",
  },
  organizersGuideNotion: {
    title: "Organizers Guide (Notion)",
    description: "A Notion-based walkthrough for organizers.",
    url: "https://youtu.be/kXwY--1M4jY",
    category: "notion",
  },
} as const satisfies Record<
  string,
  {
    title: string;
    description: string;
    url: string;
    category: VideoCategory;
  }
>;

export type VideoSourceKey = keyof typeof VIDEO_SOURCES;
export type VideoSource = (typeof VIDEO_SOURCES)[VideoSourceKey];

/**
 * These are the four core role tutorial videos shown across the app.
 * Keeping them as an explicit list prevents accidental reordering.
 */
export const ROLE_VIDEO_KEYS = [
  "participant",
  "mentor",
  "judge",
  "organizer",
] as const satisfies ReadonlyArray<VideoSourceKey>;

export type RoleVideoKey = (typeof ROLE_VIDEO_KEYS)[number];

export const ROLE_VIDEOS = ROLE_VIDEO_KEYS.map((key) => VIDEO_SOURCES[key]);

