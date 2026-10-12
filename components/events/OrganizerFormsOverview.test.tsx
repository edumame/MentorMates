import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizerFormsOverview } from "./OrganizerFormsOverview";

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

it("explains the two forms before any hover and starts with project submissions", () => {
  render(<OrganizerFormsOverview onSelect={jest.fn()} />);
  expect(
    within(screen.getByRole("region", { name: "Application form" })).getByText(
      "About the participant",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Submission form" })).getByText(
      "About the project",
    ),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Looking for project submissions?" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
});

it("steps forward and back, retains keyboard focus, and finishes after two steps", async () => {
  const onSelect = jest.fn();
  const user = userEvent.setup();
  render(<OrganizerFormsOverview onSelect={onSelect} />);
  await user.click(screen.getByRole("button", { name: "Next →" }));
  expect(
    screen.getByRole("heading", { name: "Applications are for joining" }),
  ).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Organizer quick tour" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("Organizer quick tour · 1 of 2")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next →" }));
  expect(screen.getByText("Organizer quick tour · 2 of 2")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Next →" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Got it" }));
  expect(onSelect).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("region", { name: "Organizer quick tour" }),
  ).not.toBeInTheDocument();
});

it("dismisses with Escape, remembers dismissal, and can replay", async () => {
  const user = userEvent.setup();
  const first = render(<OrganizerFormsOverview onSelect={jest.fn()} />);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Show me around" })).toHaveFocus();
  first.unmount();
  render(<OrganizerFormsOverview onSelect={jest.fn()} />);
  expect(
    screen.queryByRole("region", { name: "Organizer quick tour" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Show me around" }));
  expect(screen.getByText("Organizer quick tour · 1 of 2")).toBeVisible();
});

it.each([
  ["Manage application form", "application"],
  ["Manage submission form", "submission"],
  ["RSVP form", "rsvp"],
  ["Post-event survey", "post-survey"],
])("routes %s to its own editor", (label, view) => {
  const onSelect = jest.fn();
  render(<OrganizerFormsOverview onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(onSelect).toHaveBeenCalledWith(view);
});

it("still opens and closes when browser storage is unavailable", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  render(<OrganizerFormsOverview onSelect={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Close tutorial" }));
  expect(
    screen.queryByRole("region", { name: "Organizer quick tour" }),
  ).not.toBeInTheDocument();
});

it("shows purpose reminders on keyboard focus", async () => {
  const user = userEvent.setup();
  render(<OrganizerFormsOverview onSelect={jest.fn()} />);
  await user.keyboard("{Escape}");
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Manage application form" }),
  ).toHaveFocus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    "Collect applications",
  );
});
