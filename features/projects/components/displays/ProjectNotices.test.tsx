import { render, screen } from "@testing-library/react";
import { ProjectPrivateShareNotice } from "./ProjectPrivateShareNotice";
import { ProjectEventRemovedNote } from "./ProjectEventRemovedNote";

it("explains who can open a private project's link", () => {
  render(<ProjectPrivateShareNotice eventName="Hack Week" />);
  expect(screen.getByRole("note")).toHaveTextContent("Only members of Hack Week can open this link");
});

it("falls back to a generic event label", () => {
  render(<ProjectPrivateShareNotice />);
  expect(screen.getByRole("note")).toHaveTextContent("Only members of its event");
});

it("shows a neutral note for projects whose event was deleted", () => {
  render(<ProjectEventRemovedNote />);
  expect(screen.getByTestId("project-event-removed")).toHaveTextContent("This project's event was removed");
});
