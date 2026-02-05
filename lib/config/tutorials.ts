import { ROLE_VIDEO_KEYS, VIDEO_SOURCES } from "./video-sources";

export interface TutorialVideo {
  title: string;
  description: string;
  href: string;
}

export const TUTORIAL_VIDEOS: TutorialVideo[] = ROLE_VIDEO_KEYS.map((key) => {
  const video = VIDEO_SOURCES[key];
  return {
    title: video.title,
    description: video.description,
    href: video.url,
  };
});
