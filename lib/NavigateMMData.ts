import { ROLE_VIDEO_KEYS, VIDEO_SOURCES } from "@/lib/config/video-sources";

export interface NavigateMMVideo {
  id: number;
  url: string;
  title: string;
}

export const data: NavigateMMVideo[] = ROLE_VIDEO_KEYS.map((key, index) => ({
  id: index + 1,
  url: VIDEO_SOURCES[key].url,
  title: `As a ${key}`,
}));
