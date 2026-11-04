import { Project } from "@/lib/types";

export function isProjectFullyScored(
  project: Pick<Project, "id" | "track_ids">,
  scoredProjects: Map<string, Set<string>>
): boolean {
  if (project.track_ids.length === 0) {
    return false;
  }

  const scoredTrackIds = scoredProjects.get(project.id);
  if (!scoredTrackIds) {
    return false;
  }

  return project.track_ids.every((trackId) => scoredTrackIds.has(trackId));
}

export function getNextProjectId(
  projects: Array<{ id: string }>,
  currentProjectId: string | null,
  direction: 1 | -1
): string | null {
  if (projects.length === 0) {
    return null;
  }

  if (!currentProjectId) {
    return projects[0].id;
  }

  const currentIndex = projects.findIndex(
    (project) => project.id === currentProjectId
  );

  if (currentIndex < 0) {
    return projects[0].id;
  }

  const nextIndex =
    direction === 1
      ? (currentIndex + 1) % projects.length
      : (currentIndex - 1 + projects.length) % projects.length;

  return projects[nextIndex].id;
}

// Arrow keys pressed here belong to the control, and switching cards would
// unmount the scoring form and drop its unsaved draft. The form is matched as a
// whole so its buttons and checkboxes are covered too. This is narrower than the
// swipe guard on purpose: arrows must keep working from the Previous/Next buttons.
const CARD_ARROW_KEY_EXCLUDED_TARGETS =
  "input, textarea, select, form, [role='slider'], [role='alertdialog'], [contenteditable]:not([contenteditable='false'])";

export function shouldHandleCardArrowKey(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return false;
  }

  return !(
    event.target instanceof Element &&
    event.target.closest(CARD_ARROW_KEY_EXCLUDED_TARGETS)
  );
}

export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}
