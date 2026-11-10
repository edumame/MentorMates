/**
 * Shown on both project-detail routes when the project's event was deleted
 * (event deletion keeps projects with event_id = NULL, lane C ORG-007).
 */
export function ProjectEventRemovedNote() {
  return (
    <div className="space-y-2" data-testid="project-event-removed">
      <h3 className="text-lg font-bold text-black tracking-tight">Event</h3>
      <p className="text-base text-gray-600">
        This project&apos;s event was removed. The project is kept, but it can no
        longer be submitted, judged or voted on.
      </p>
    </div>
  );
}
