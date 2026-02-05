export type VideoCategory = "role" | "guide";

export type VideoSource = {
  title: string;
  description: string;
  url: string;
  category: VideoCategory;
};

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
  organizersGuide: {
    title: "Organizers Guide",
    description:
      "Walkthrough of the organizer workflow and best practices from the Notion guide.",
    url: "https://youtu.be/kXwY--1M4jY",
    category: "guide",
  },
  participantsGuide: {
    title: "Participants Guide",
    description:
      "Participant onboarding walkthrough based on the Notion guide.",
    url: "https://youtu.be/RMcgFz-R2n4",
    category: "guide",
  },
} satisfies Record<string, VideoSource>;

export type VideoSourceKey = keyof typeof VIDEO_SOURCES;

export const ROLE_VIDEO_KEYS = [
  "participant",
  "mentor",
  "judge",
  "organizer",
] as const satisfies ReadonlyArray<VideoSourceKey>;

export const ROLE_VIDEOS = ROLE_VIDEO_KEYS.map((key) => ({
  key,
  ...VIDEO_SOURCES[key],
}));
