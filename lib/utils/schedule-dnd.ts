import { isSortable } from "@dnd-kit/react/sortable";
import {
  parseScheduleDragId,
  type ScheduleEventPosition,
} from "@/lib/utils/schedule";

type DragEndOperation = {
  source: Parameters<typeof isSortable>[0];
  target: Parameters<typeof isSortable>[0];
};

/**
 * Derives the schedule move performed by a completed drag operation.
 *
 * dnd-kit's OptimisticSortingPlugin live-reorders sortables while dragging,
 * so at drag end the source's (group, index) already describe where the item
 * landed and (initialGroup, initialIndex) where it started — the drop
 * target's original id must NOT be used for the destination. Dropping onto an
 * empty day's plain drop zone is the one case the plugin does not track;
 * there we fall back to the drop target's id.
 */
export function getScheduleDragMove(operation: DragEndOperation): {
  from: ScheduleEventPosition;
  to: ScheduleEventPosition;
} | null {
  const { source, target } = operation;
  if (!source || !isSortable(source)) return null;
  const { sortable } = source;

  const initialDay = parseScheduleDragId(sortable.initialGroup);
  if (!initialDay) return null;
  const from: ScheduleEventPosition = {
    dayIndex: initialDay.dayIndex,
    eventIndex: sortable.initialIndex,
  };

  const finalDay = parseScheduleDragId(sortable.group);
  const moved =
    sortable.group !== sortable.initialGroup ||
    sortable.index !== sortable.initialIndex;
  if (finalDay && moved) {
    return {
      from,
      to: { dayIndex: finalDay.dayIndex, eventIndex: sortable.index },
    };
  }

  const targetPos = parseScheduleDragId(target?.id);
  if (targetPos && targetPos.dayIndex !== from.dayIndex) {
    return { from, to: targetPos };
  }

  return null;
}
