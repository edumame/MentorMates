import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const intakeFormDialogMock = jest.fn((props: unknown) => {
  void props;
  return null;
});
jest.mock("@/features/intake-forms/components/IntakeFormDialog", () => ({
  IntakeFormDialog: (props: unknown) => intakeFormDialogMock(props),
}));

import { RsvpButton } from "./RsvpButton";

function mockStatusFetch(status: { hasActiveForm: boolean; completed: boolean }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => status,
  }) as unknown as typeof fetch;
}

describe("RsvpButton", () => {
  beforeEach(() => {
    intakeFormDialogMock.mockClear();
  });

  it("renders nothing when no RSVP form is published", async () => {
    mockStatusFetch({ hasActiveForm: false, completed: false });

    const { container } = render(<RsvpButton eventId="event-1" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events/event-1/intake-form/status?context=rsvp",
        { cache: "no-store" }
      );
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the status request fails", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { container } = render(<RsvpButton eventId="event-1" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'RSVP to Event' when a form is published and not yet completed", async () => {
    mockStatusFetch({ hasActiveForm: true, completed: false });

    render(<RsvpButton eventId="event-1" />);

    expect(
      await screen.findByRole("button", { name: /rsvp to event/i })
    ).toBeInTheDocument();
  });

  it("shows 'Update RSVP' when the user already submitted", async () => {
    mockStatusFetch({ hasActiveForm: true, completed: true });

    render(<RsvpButton eventId="event-1" />);

    expect(
      await screen.findByRole("button", { name: /update rsvp/i })
    ).toBeInTheDocument();
  });

  it("opens the intake dialog with the rsvp context when clicked", async () => {
    mockStatusFetch({ hasActiveForm: true, completed: false });

    render(<RsvpButton eventId="event-1" />);

    const button = await screen.findByRole("button", { name: /rsvp to event/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(intakeFormDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          open: true,
          eventId: "event-1",
          context: "rsvp",
        })
      );
    });
  });
});
