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
      "Learn how to join events, submit projects, and track feedback.",
    url: "https://youtu.be/RMcgFz-R2n4",
    category: "role",
  },
  mentor: {
    title: "Mentor Guide",
    description:
      "Learn how to review projects and deliver high-quality feedback.",
    url: "https://youtu.be/twigjULNzgQ",
    category: "role",
  },
  judge: {
    title: "Judge Guide",
    description: "Understand scoring and judging workflow in MentorMates.",
    url: "https://www.loom.com/share/ba6d836421194a8fb96218ece6324cb8",
    category: "role",
  },
  organizer: {
    title: "Organizer Guide",
    description:
      "Run events, manage submissions, and coordinate mentors/judges.",
    url: "https://youtu.be/kXwY--1M4jY",
    category: "role",
  },
  aiVoiceAgent: {
    title: "MentorMates AI Voice Agent Guide",
    description: "Overview of the AI voice agent workflow and capabilities.",
    url: "https://www.loom.com/share/5883ad9cbfb944fa925e75f3b2abdd62",
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
