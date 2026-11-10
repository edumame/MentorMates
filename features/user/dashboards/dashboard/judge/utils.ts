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

/**
 * Group a judge's score rows by project and track. project_scores rows outlive
 * project_tracks membership, so rows for a track the project has left are
 * skipped: they must not count towards progress or averages.
 */
export function buildJudgeScoreMaps(
  scoreRows: Array<{
    project_id: string;
    track_id: string;
    scores: Record<string, number> | null;
  }>,
  projects: Array<Pick<Project, "id" | "track_ids">>
) {
  const currentTrackIds = new Map(
    projects.map((project) => [project.id, project.track_ids])
  );
  const scoredProjects = new Map<string, Set<string>>();
  const scoreValues: ScoreValuesByProject = new Map();

  scoreRows.forEach((score) => {
    if (!currentTrackIds.get(score.project_id)?.includes(score.track_id)) {
      return;
    }

    if (!scoredProjects.has(score.project_id)) {
      scoredProjects.set(score.project_id, new Set());
    }
    scoredProjects.get(score.project_id)?.add(score.track_id);

    if (score.scores && typeof score.scores === "object") {
      if (!scoreValues.has(score.project_id)) {
        scoreValues.set(score.project_id, new Map());
      }
      scoreValues.get(score.project_id)?.set(score.track_id, score.scores);
    }
  });

  return { scoredProjects, scoreValues };
}

export type ScoreValuesByProject = Map<
  string,
  Map<string, Record<string, number>>
>;

export function setTrackScores(
  scoreValues: ScoreValuesByProject,
  projectId: string,
  trackId: string,
  scores: Record<string, number>
): ScoreValuesByProject {
  const updated = new Map(scoreValues);
  const projectScores = new Map(updated.get(projectId) ?? []);
  projectScores.set(trackId, scores);
  updated.set(projectId, projectScores);
  return updated;
}

export function removeTrackScores(
  scoreValues: ScoreValuesByProject,
  projectId: string,
  trackId: string
): ScoreValuesByProject {
  const updated = new Map(scoreValues);
  const projectScores = new Map(updated.get(projectId) ?? []);
  projectScores.delete(trackId);

  if (projectScores.size === 0) {
    updated.delete(projectId);
  } else {
    updated.set(projectId, projectScores);
  }

  return updated;
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

export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

// Elements whose own arrow-key behaviour must win over card navigation
// (text cursor movement, slider value, select/radio choice, menus).
const ARROW_KEY_OWNER_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "[contenteditable]:not([contenteditable='false'])",
  "[role=slider]",
  "[role=radiogroup]",
  "[role=radio]",
  "[role=combobox]",
  "[role=listbox]",
  "[role=option]",
  "[role=menu]",
  "[role=menuitem]",
  "[role=tablist]",
  "[role=tab]",
  "[role=spinbutton]",
  "[role=textbox]",
].join(", ");

/**
 * Returns the card-navigation direction for a window keydown, or null when the
 * key should be left alone (JUDGE-003): non-arrow keys, modified keys, events a
 * component already handled, or keys pressed inside a form control or widget
 * that uses arrow keys itself (e.g. the rubric sliders or the Comments box).
 */
export function getCardNavigationDirection(event: {
  key: string;
  defaultPrevented: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}): 1 | -1 | null {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return null;
  if (event.defaultPrevented) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const target = event.target as Element | null;
  if (target && typeof target.closest === "function" && target.closest(ARROW_KEY_OWNER_SELECTOR)) {
    return null;
  }
  return event.key === "ArrowLeft" ? -1 : 1;
}
