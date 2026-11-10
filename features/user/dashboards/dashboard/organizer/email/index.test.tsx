import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailTab } from "./index";
import { fakeEventUsersResponse } from "@/lib/events/fake-event-users-api";

jest.mock("@/lib/hooks/use-toast", () => {
  const toast = jest.fn();
  return { useToast: () => ({ toast }) };
});

describe("EmailTab recipients", () => {
  beforeEach(() => {
    // jsdom has no fetch for jest.spyOn to wrap.
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("offers every member of an event larger than one API page", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async (input) =>
          fakeEventUsersResponse(String(input), 501) as unknown as Response
      );

    render(<EmailTab eventId="event-1" />);

    const selectAll = await screen.findByRole("button", {
      name: "Select All (501)",
    });
    await userEvent.click(selectAll);

    expect(screen.getByText("Select Recipients (501 selected)")).toBeInTheDocument();
  });

  it("does not offer a partial recipient list when a later page fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("offset=500")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Failed to fetch event users" }),
        } as unknown as Response;
      }
      return fakeEventUsersResponse(String(input), 501) as unknown as Response;
    });

    render(<EmailTab eventId="event-1" />);

    expect(
      await screen.findByRole("button", { name: "Select All (0)" })
    ).toBeInTheDocument();
  });
});
