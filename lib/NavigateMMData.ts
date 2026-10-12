import { ROLE_VIDEO_KEYS, VIDEO_SOURCES } from "@/lib/config/video-sources";

interface NavigateMMProps {
  id: number;
  url: string;
  title: string;
}

const ROLE_LABELS: Record<(typeof ROLE_VIDEO_KEYS)[number], string> = {
  participant: "As a participant",
  mentor: "As a mentor",
  judge: "As a judge",
  organizer: "As an organizer",
};

export const data: NavigateMMProps[] = ROLE_VIDEO_KEYS.map((key, index) => ({
  id: index + 1,
  url: VIDEO_SOURCES[key].url,
  title: ROLE_LABELS[key],
}));
