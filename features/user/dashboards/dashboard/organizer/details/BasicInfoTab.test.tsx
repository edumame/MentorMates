import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BasicInfoTab } from "./BasicInfoTab";
import { EventVisibility, type EventDetails } from "@/lib/types";

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
      })),
    },
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

const baseEvent: EventDetails = {
  event_id: "event-1",
  event_name: "Hack Night",
  event_date: "2026-04-18",
  location: "Online",
  visibility: EventVisibility.Draft,
  paid: false,
  event_type: [],
  event_description: "",
  event_blurb: "",
  event_schedule: [],
  event_prizes: [],
  event_resources: [],
  created_at: "2026-04-18T00:00:00.000Z",
  rules: [],
};

function BasicInfoTabHarness() {
  const [event, setEvent] = useState<EventDetails>(baseEvent);

  return (
    <div>
      <BasicInfoTab
        event={event}
        setEvent={setEvent}
        saving={false}
        setSaving={jest.fn()}
        toast={jest.fn()}
        router={{ refresh: jest.fn(), push: jest.fn() } as never}
      />
      <div data-testid="max-projects">{String(event.max_projects)}</div>
    </div>
  );
}

describe("BasicInfoTab", () => {
  it("stores the project submission cap in organizer event state", async () => {
    const user = userEvent.setup();

    render(<BasicInfoTabHarness />);

    const input = screen.getByLabelText(/project submission cap/i);
    await user.type(input, "8");

    expect(screen.getByTestId("max-projects")).toHaveTextContent("8");
  });
});
