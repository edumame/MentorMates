import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntakeFormDialog } from "./IntakeFormDialog";
const schema = {
  title: "RSVP",
  description: "Synthetic local RSVP form",
  fields: [
    {
      id: "notes",
      key: "notes",
      label: "Notes",
      type: "long_text",
      required: false,
    },
  ],
};
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
const props = {
  open: true,
  eventId: "event-1",
  context: "rsvp" as const,
  onClose: jest.fn(),
  onCompleted: jest.fn(),
};
const response = (notes: string) => ({
  ok: true,
  json: async () => ({
    form: { formVersionId: "v1", schema, answers: { notes } },
  }),
});
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(response("Saved notes"));
});
it("reloads persisted answers when reopening the same version instead of reusing stale edits", async () => {
  const { rerender } = render(<IntakeFormDialog {...props} />);
  await waitFor(() =>
    expect(screen.getByRole("textbox")).toHaveValue("Saved notes"),
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Abandoned edit" },
  });
  rerender(<IntakeFormDialog {...props} open={false} />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  (fetch as jest.Mock).mockResolvedValue(response("Newly persisted notes"));
  rerender(<IntakeFormDialog {...props} />);
  await waitFor(() =>
    expect(screen.getByRole("textbox")).toHaveValue("Newly persisted notes"),
  );
});
