import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MentorAvailabilityManager } from "./MentorAvailabilityManager";
import { defaultSlotWindow } from "./utils";

const toast = jest.fn();

function toLocalInputValue(value: string) {
  const date = new Date(value);
  const pad = (part: number) => part.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") +
    "T" +
    [pad(date.getHours()), pad(date.getMinutes())].join(":");
}

const mockSupabase = {
  auth: {
    getUser: jest.fn(async () => ({
      data: { user: { id: "mentor-1" } },
    })),
  },
  from: jest.fn((table: string) => {
    if (table !== "events") {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({
            data: {
              submission_time_start: "2026-05-01T13:30:00.000Z",
              submission_time_cutoff: "2026-05-01T21:00:00.000Z",
            },
            error: null,
          })),
        })),
      })),
    };
  }),
};

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

jest.mock("@/app/utils/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

describe("MentorAvailabilityManager", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    toast.mockReset();
    mockSupabase.auth.getUser.mockClear();
    mockSupabase.from.mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ availability: [] }),
    }) as jest.Mock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("defaults to a one-hour slot (not the whole submission window) and still lets mentors edit it", async () => {
    const user = userEvent.setup();
    const suggested = defaultSlotWindow({
      start: "2026-05-01T13:30:00.000Z",
      end: "2026-05-01T21:00:00.000Z",
    });
    const expectedStart = toLocalInputValue(suggested.start.toISOString());
    const expectedEnd = toLocalInputValue(suggested.end.toISOString());

    render(<MentorAvailabilityManager eventId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(expectedStart)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(expectedEnd)).toBeInTheDocument();
    expect(suggested.end.getTime() - suggested.start.getTime()).toBe(3600_000);
    expect(screen.getByText(/one-hour slot/i)).toBeInTheDocument();

    const startInput = screen.getByLabelText("Start");
    await user.clear(startInput);
    await user.type(startInput, "2026-05-02T09:00");

    expect(screen.getByDisplayValue("2026-05-02T09:00")).toBeInTheDocument();
  });

  it("lets Max bookings be cleared and retyped", async () => {
    const user = userEvent.setup();

    render(<MentorAvailabilityManager eventId="event-1" />);

    const maxBookings = await screen.findByLabelText("Max bookings");
    await user.clear(maxBookings);
    expect(maxBookings).toHaveValue(null);

    await user.keyboard("12");
    expect(maxBookings).toHaveValue(12);
  });

  describe("submitting with Enter from Max bookings", () => {
    function postedMaxBookings() {
      return (global.fetch as jest.Mock).mock.calls
        .filter(([, init]) => init?.method === "POST")
        .map(([, init]) => JSON.parse(init.body).max_bookings);
    }

    async function renderForm() {
      const user = userEvent.setup();

      render(<MentorAvailabilityManager eventId="event-1" />);

      // Wait for the suggested one-hour slot, so the form is ready to submit.
      const suggested = defaultSlotWindow({
        start: "2026-05-01T13:30:00.000Z",
        end: "2026-05-01T21:00:00.000Z",
      });
      await screen.findByDisplayValue(
        toLocalInputValue(suggested.start.toISOString())
      );
      return { user, maxBookings: screen.getByLabelText("Max bookings") };
    }

    it("resets the field to 1 and then sends what is displayed", async () => {
      const { user, maxBookings } = await renderForm();

      await user.clear(maxBookings);
      await user.keyboard("5{Enter}");

      await waitFor(() => expect(postedMaxBookings()).toEqual([5]));
      await waitFor(() => expect(maxBookings).toHaveValue(1));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add slot" })).toBeEnabled()
      );
      expect(maxBookings).toHaveFocus();

      await user.keyboard("{Enter}");

      await waitFor(() => expect(postedMaxBookings()).toEqual([5, 1]));
    });

    it("keeps the reset when the field is blurred afterwards", async () => {
      const { user, maxBookings } = await renderForm();

      await user.clear(maxBookings);
      await user.keyboard("5{Enter}");
      await waitFor(() => expect(maxBookings).toHaveValue(1));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add slot" })).toBeEnabled()
      );

      await user.tab();
      expect(maxBookings).toHaveValue(1);

      await user.click(screen.getByRole("button", { name: "Add slot" }));

      await waitFor(() => expect(postedMaxBookings()).toEqual([5, 1]));
    });

    it("does not submit an empty field", async () => {
      const { user, maxBookings } = await renderForm();

      await user.clear(maxBookings);
      await user.keyboard("{Enter}");

      expect(postedMaxBookings()).toEqual([]);
    });
  });

  it("shows attendees by name, lets the mentor cancel one booking, and confirms before deleting a booked slot", async () => {
    const user = userEvent.setup();
    const slot = {
      id: "slot-1", mentor_id: "mentor-1", event_id: "event-1",
      start_time: "2030-05-01T15:00:00.000Z", end_time: "2030-05-01T16:00:00.000Z",
      max_bookings: 2, created_at: "2030-01-01T00:00:00.000Z", booking_count: 1, viewer_booking_id: null,
      participants: [{ display_name: "Ada", email: "ada@example.test", booking_id: "booking-1" }],
    };
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => (init?.method === "DELETE" ? { success: true } : { availability: [slot] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MentorAvailabilityManager eventId="event-1" />);
    expect(await screen.findByText("Ada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/events/event-1/mentor-bookings?id=booking-1", { method: "DELETE" })
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/1 participant has booked this slot/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/events/event-1/mentor-availability?id=slot-1&force=true", { method: "DELETE" })
    );
  });
});
