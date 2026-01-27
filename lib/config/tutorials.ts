export interface TutorialVideo {
  title: string;
  description: string;
  href: string;
}

export const TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    title: "Participant",
    description: "Submit projects, share ideas, and get real feedback from mentors and judges.",
    href: "https://youtu.be/GMHO4vdLgD0",
  },
  {
    title: "Mentor",
    description: "Support participants with actionable, encouraging feedback that helps them grow.",
    href: "https://youtu.be/mAm-LnMK5dA",
  },
  {
    title: "Judge",
    description: "Review projects, score fairly, and provide constructive feedback.",
    href: "https://youtu.be/o1iCt7qE5UY",
  },
  {
    title: "Organizer",
    description: "Manage events: set up submissions, assign mentors/judges, and configure parameters.",
    href: "https://youtu.be/DFGjGusKtdo",
  },
];
