import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminPage from "./page";

const push = jest.fn();
const toast = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

jest.mock("@/components/events/approval-log", () => ({
  ApprovalLog: ({ eventId }: { eventId: string }) => (
    <div>Approval log {eventId}</div>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

jest.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <button className={className}>{children}</button>,
  SelectValue: () => null,
}));

const from = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
    from: (...args: unknown[]) => from(...args),
  },
}));

describe("AdminPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const eventsBuilder = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            event_id: "event-1",
            event_name: "Hack Night",
            event_date: "2026-04-20T12:00:00.000Z",
            location: "New York",
            event_description: "Build projects",
            event_blurb: "A weekend hackathon",
            cover_image_url: null,
            visibility: "public",
            paid: false,
            stripe_price_id: null,
            slug: "hack-night",
            event_type: ["Hackathon"],
            featured: true,
            approval_status: "approved",
            created_at: "2026-03-01T12:00:00.000Z",
          },
        ],
        error: null,
      }),
    };

    const organizersBuilder = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            event_id: "event-1",
            user_id: "user-1",
            user_profiles: {
              uid: "user-1",
              display_name: "Alice Organizer",
              email: "alice@example.com",
            },
          },
        ],
        error: null,
      }),
    };

    from.mockImplementation((table: string) => {
      if (table === "events") {
        return eventsBuilder;
      }

      if (table === "user_event_roles") {
        return organizersBuilder;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { supabase } = jest.requireMock("@/lib/supabase") as {
      supabase: {
        auth: { getUser: jest.Mock };
        rpc: jest.Mock;
      };
    };

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
    });
    supabase.rpc.mockImplementation(async (name: string) =>
      name === "get_event_rejection_reasons"
        ? { data: [], error: null }
        : { data: true }
    );
  });

  it("shows organizer information for each event", async () => {
    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText("Event Management Dashboard")).toBeInTheDocument()
    );

    expect(
      screen.getByText("Organizers: Alice Organizer")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("Alice Organizer")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows submitter contact from the admin-only event_submissions relation", async () => {
    const eventsBuilder = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            event_id: "event-2",
            event_name: "Community Meetup",
            event_date: "2026-04-21T12:00:00.000Z",
            location: "Online",
            visibility: "public",
            slug: "community-meetup",
            event_type: [],
            featured: true,
            approval_status: "approved",
            created_at: "2026-03-02T12:00:00.000Z",
            event_submissions: {
              submitter_email: "submitter@example.com",
              submitter_name: "Sam Submitter",
              organizer_affiliation: "Example U",
              expected_attendance: 40,
            },
          },
        ],
        error: null,
      }),
    };
    const organizersBuilder = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    from.mockImplementation((table: string) =>
      table === "events" ? eventsBuilder : organizersBuilder
    );

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText("Event Management Dashboard")).toBeInTheDocument()
    );
    expect(eventsBuilder.select.mock.calls[0][0]).toContain("event_submissions");
    const eventColumns = eventsBuilder.select.mock.calls[0][0].split("event_submissions")[0];
    expect(eventColumns).not.toContain("submitter_email");

    expect(
      screen.getByText("Organizers: Sam Submitter <submitter@example.com>")
    ).toBeInTheDocument();
  });
  it("reads rejection reasons through the RPC, not the events column (XL-014)", async () => {
    const eventsBuilder = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            event_id: "event-3",
            event_name: "QA Rejected Event",
            event_date: "2026-04-22T12:00:00.000Z",
            location: "Online",
            visibility: "draft",
            slug: "qa-rejected",
            event_type: [],
            featured: true,
            approval_status: "rejected",
            created_at: "2026-03-03T12:00:00.000Z",
          },
        ],
        error: null,
      }),
    };
    const organizersBuilder = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    from.mockImplementation((table: string) =>
      table === "events" ? eventsBuilder : organizersBuilder
    );
    const { supabase } = jest.requireMock("@/lib/supabase") as {
      supabase: { rpc: jest.Mock };
    };
    supabase.rpc.mockImplementation(async (name: string) =>
      name === "get_event_rejection_reasons"
        ? { data: [{ event_id: "event-3", rejection_reason: "QA duplicate listing" }], error: null }
        : { data: true }
    );

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText("Event Management Dashboard")).toBeInTheDocument()
    );
    expect(eventsBuilder.select.mock.calls[0][0]).not.toContain("rejection_reason");
    expect(supabase.rpc).toHaveBeenCalledWith("get_event_rejection_reasons", {
      p_event_ids: ["event-3"],
    });
    const expand = screen.queryAllByRole("button", { name: "Expand" });
    if (expand[0]) fireEvent.click(expand[0]);
    expect((await screen.findAllByDisplayValue("QA duplicate listing")).length).toBeGreaterThan(0);
  });
});
