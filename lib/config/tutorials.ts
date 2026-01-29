import { ROLE_VIDEO_KEYS, VIDEO_SOURCES } from "@/lib/config/video-sources";

export interface TutorialVideo {
  title: string;
  description: string;
  href: string;
}

export const TUTORIAL_VIDEOS: TutorialVideo[] = ROLE_VIDEO_KEYS.map((key) => ({
  // Keep display titles short for the cards.
  title: VIDEO_SOURCES[key].title.replace(" Guide", ""),
  description: VIDEO_SOURCES[key].description,
  href: VIDEO_SOURCES[key].url,
}));
