import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MentorAvailabilityManager } from "./MentorAvailabilityManager";

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

  it("defaults the form to the hackathon submission window and still lets mentors edit it", async () => {
    const user = userEvent.setup();
    const expectedStart = toLocalInputValue("2026-05-01T13:30:00.000Z");
    const expectedEnd = toLocalInputValue("2026-05-01T21:00:00.000Z");

    render(<MentorAvailabilityManager eventId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(expectedStart)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(expectedEnd)).toBeInTheDocument();
    expect(
      screen.getByText(
        /defaulted to the hackathon submission window/i
      )
    ).toBeInTheDocument();

    const startInput = screen.getByLabelText("Start");
    await user.clear(startInput);
    await user.type(startInput, "2026-05-02T09:00");

    expect(screen.getByDisplayValue("2026-05-02T09:00")).toBeInTheDocument();
  });

  it("shows a 'with' line only for slots that have bookers", async () => {
    const slot = {
      mentor_id: "mentor-1",
      event_id: "event-1",
      start_time: "2026-05-01T14:00:00.000Z",
      end_time: "2026-05-01T14:30:00.000Z",
      max_bookings: 1,
      created_at: "2026-04-01T00:00:00.000Z",
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        availability: [
          {
            ...slot,
            id: "booked",
            booking_count: 1,
            participants: [
              { display_name: "Alice", email: "alice@example.test" },
            ],
          },
          { ...slot, id: "empty", booking_count: 0, participants: [] },
        ],
      }),
    }) as jest.Mock;

    render(<MentorAvailabilityManager eventId="event-1" />);

    expect(
      await screen.findByText("with alice@example.test")
    ).toBeInTheDocument();
    expect(screen.getByText("0 / 1 booked")).toBeInTheDocument();
    expect(screen.getAllByText(/^with\b/)).toHaveLength(1);
  });
});
