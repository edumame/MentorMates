"use client";

import { Button } from "@/components/ui/button";
import { IntakeFormBuilder } from "@/features/intake-forms/components/IntakeFormBuilder";
import { SubmissionFieldsSettings } from "@/features/user/dashboards/dashboard/organizer/submissions/SubmissionFieldsSettings";
import { OrganizerFormsOverview } from "./OrganizerFormsOverview";

const intakeViews = {
  application: {
    context: "registration",
    title: "Application form",
    copy: "Collect information about people applying to join your event. To collect their project work, use Submission form.",
  },
  rsvp: {
    context: "rsvp",
    title: "RSVP form",
    copy: "Ask registered attendees to confirm their attendance.",
  },
  "post-survey": {
    context: "post_survey",
    title: "Post-event survey",
    copy: "Collect feedback from attendees after your event.",
  },
} as const;

export function OrganizerFormsTab({
  eventId,
  view,
  onViewChange,
}: {
  eventId: string;
  view: string;
  onViewChange: (view: string) => void;
}) {
  const intake = Object.prototype.hasOwnProperty.call(intakeViews, view)
    ? intakeViews[view as keyof typeof intakeViews]
    : null;
  if (view !== "submission" && !intake)
    return <OrganizerFormsOverview onSelect={onViewChange} />;
  return (
    <div className="space-y-5">
      <Button variant="outline" onClick={() => onViewChange("overview")}>
        ← Back to event forms
      </Button>
      {view === "submission" ? (
        <SubmissionFieldsSettings eventId={eventId} />
      ) : (
        intake && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{intake.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {intake.copy}
              </p>
            </div>
            <IntakeFormBuilder
              key={intake.context}
              eventId={eventId}
              context={intake.context}
            />
          </section>
        )
      )}
    </div>
  );
}
