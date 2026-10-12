import { fireEvent, render, screen } from "@testing-library/react";
import { OrganizerFormsTab } from "./OrganizerFormsTab";

jest.mock("@/features/intake-forms/components/IntakeFormBuilder", () => ({
  IntakeFormBuilder: ({
    eventId,
    context,
  }: {
    eventId: string;
    context: string;
  }) => (
    <div>
      Intake editor: {eventId} / {context}
    </div>
  ),
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/submissions/SubmissionFieldsSettings",
  () => ({
    SubmissionFieldsSettings: ({ eventId }: { eventId: string }) => (
      <div>Submission editor: {eventId}</div>
    ),
  }),
);

it.each([
  ["application", "registration"],
  ["rsvp", "rsvp"],
  ["post-survey", "post_survey"],
])("uses the existing %s editor with its correct context", (view, context) => {
  render(
    <OrganizerFormsTab
      eventId="event-123"
      view={view}
      onViewChange={jest.fn()}
    />,
  );
  expect(
    screen.getByText(`Intake editor: event-123 / ${context}`),
  ).toBeVisible();
  expect(screen.queryByText(/Submission editor:/)).not.toBeInTheDocument();
});

it("uses the submission editor and returns to the forms overview", () => {
  const onViewChange = jest.fn();
  render(
    <OrganizerFormsTab
      eventId="event-123"
      view="submission"
      onViewChange={onViewChange}
    />,
  );
  expect(screen.getByText("Submission editor: event-123")).toBeVisible();
  expect(screen.queryByText(/Intake editor:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Back to event forms/ }));
  expect(onViewChange).toHaveBeenCalledWith("overview");
});

it.each(["overview", "basics", "invalid", "toString"])(
  "falls back to the overview for %s",
  (view) => {
    render(
      <OrganizerFormsTab
        eventId="event-123"
        view={view}
        onViewChange={jest.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Event forms" })).toBeVisible();
  },
);
