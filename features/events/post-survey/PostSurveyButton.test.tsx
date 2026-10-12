import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const intakeFormDialogMock = jest.fn((props: unknown) => {
  void props;
  return null;
});
jest.mock("@/features/intake-forms/components/IntakeFormDialog", () => ({
  IntakeFormDialog: (props: unknown) => intakeFormDialogMock(props),
}));

import { PostSurveyButton } from "./PostSurveyButton";

function mockStatusFetch(status: { hasActiveForm: boolean; completed: boolean }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => status,
  }) as unknown as typeof fetch;
}

describe("PostSurveyButton", () => {
  beforeEach(() => {
    intakeFormDialogMock.mockClear();
  });

  it("renders nothing when no post-survey form is published", async () => {
    mockStatusFetch({ hasActiveForm: false, completed: false });

    const { container } = render(<PostSurveyButton eventId="event-1" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events/event-1/intake-form/status?context=post_survey",
        { cache: "no-store" }
      );
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the status request fails", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { container } = render(<PostSurveyButton eventId="event-1" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Take Post-Event Survey' when a form is published and not yet completed", async () => {
    mockStatusFetch({ hasActiveForm: true, completed: false });

    render(<PostSurveyButton eventId="event-1" />);

    expect(
      await screen.findByRole("button", { name: /take post-event survey/i })
    ).toBeInTheDocument();
  });

  it("shows 'Update Survey Response' when the user already submitted", async () => {
    mockStatusFetch({ hasActiveForm: true, completed: true });

    render(<PostSurveyButton eventId="event-1" />);

    expect(
      await screen.findByRole("button", { name: /update survey response/i })
    ).toBeInTheDocument();
  });

  it("opens the intake dialog with the post_survey context when clicked", async () => {
    mockStatusFetch({ hasActiveForm: true, completed: false });

    render(<PostSurveyButton eventId="event-1" />);

    const button = await screen.findByRole("button", {
      name: /take post-event survey/i,
    });
    await userEvent.click(button);

    await waitFor(() => {
      expect(intakeFormDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          open: true,
          eventId: "event-1",
          context: "post_survey",
        })
      );
    });
  });
});
