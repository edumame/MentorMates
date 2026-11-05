import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MentorCards } from "./MentorCards";

type MeetingFixture = {
  id: string;
  name: string;
  status: string;
  event_id: string | null;
  project_id: string | null;
  agent: null;
};

type GetManyInput = { page?: number; eventId?: string; projectId?: string };

const PAGE_SIZE = 10;

const mockState: {
  meetings: MeetingFixture[];
  getManyInputs: GetManyInput[];
} = { meetings: [], getManyInputs: [] };

const mockGetMany = async (input: GetManyInput) => {
  mockState.getManyInputs.push(input);
  const matching = mockState.meetings.filter(
    (m) =>
      (!input.eventId || m.event_id === input.eventId) &&
      (!input.projectId || m.project_id === input.projectId),
  );
  const offset = ((input.page ?? 1) - 1) * PAGE_SIZE;
  return {
    items: matching.slice(offset, offset + PAGE_SIZE),
    total: matching.length,
    totalPages: Math.ceil(matching.length / PAGE_SIZE),
  };
};

const mockGetFilterOptions = async () => ({
  eventIds: Array.from(new Set(mockState.meetings.map((m) => m.event_id).filter(Boolean))),
  projectIds: Array.from(new Set(mockState.meetings.map((m) => m.project_id).filter(Boolean))),
});

const mockRemove = async ({ id }: { id: string }) => {
  mockState.meetings = mockState.meetings.filter((m) => m.id !== id);
  return { id };
};

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    meetings: {
      getMany: {
        queryOptions: (input: GetManyInput, opts?: object) => ({
          queryKey: ["getMany", input],
          queryFn: () => mockGetMany(input),
          ...opts,
        }),
      },
      getFilterOptions: {
        queryOptions: () => ({
          queryKey: ["getFilterOptions"],
          queryFn: mockGetFilterOptions,
        }),
      },
      remove: {
        mutationOptions: (opts: object) => ({ mutationFn: mockRemove, ...opts }),
      },
    },
  }),
}));

jest.mock("@/lib/supabase", () => {
  const nameRows = (table: string, ids: string[]) =>
    table === "events"
      ? ids.map((id) => ({ event_id: id, event_name: `Event ${id}` }))
      : ids.map((id) => ({ id, project_name: `Project ${id}` }));

  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      rpc: async () => ({ data: true }),
      from: (table: string) => ({
        select: () => ({
          in: async (_column: string, ids: string[]) => ({ data: nameRows(table, ids) }),
          eq: () => ({ eq: async () => ({ data: [] }) }),
        }),
      }),
    },
  };
});

jest.mock("@/modules/meetings/ui/components/update-meeting-dialog", () => ({
  UpdateMeetingDialog: () => null,
}));

jest.mock("@/lib/hooks/use-confirm", () => ({
  useConfirm: () => [() => null, async () => true],
}));

// Radix menus only open on pointer events; the items themselves are what these tests exercise.
jest.mock("@/components/ui/dropdown-menu", () => {
  const Passthrough = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuTrigger: Passthrough,
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>,
  };
});

const meetings = (count: number, overrides: Partial<MeetingFixture> = {}, prefix = "Meeting") =>
  Array.from({ length: count }, (_, i): MeetingFixture => ({
    id: `${prefix}-${i + 1}`,
    name: `${prefix} ${i + 1}`,
    status: "upcoming",
    event_id: null,
    project_id: null,
    agent: null,
    ...overrides,
  }));

const renderCards = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MentorCards />
    </QueryClientProvider>,
  );
};

describe("MentorCards", () => {
  beforeEach(() => {
    mockState.meetings = [];
    mockState.getManyInputs = [];
  });

  it("reaches meetings beyond the first page", async () => {
    mockState.meetings = meetings(25);
    renderCards();

    expect(await screen.findByText("Meeting 1")).toBeInTheDocument();
    expect(screen.queryByText("Meeting 11")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Meeting 11")).toBeInTheDocument();
    expect(screen.queryByText("Meeting 1")).not.toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(mockState.getManyInputs).toContainEqual(expect.objectContaining({ page: 2 }));

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Meeting 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(await screen.findByText("Meeting 11")).toBeInTheDocument();
  });

  it("hides the pagination controls when everything fits on one page", async () => {
    mockState.meetings = meetings(PAGE_SIZE);
    renderCards();

    expect(await screen.findByText("Meeting 10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("offers filter options for events and projects outside the first page", async () => {
    mockState.meetings = [
      ...meetings(PAGE_SIZE, { event_id: "a", project_id: "p" }, "Recent"),
      ...meetings(1, { event_id: "b", project_id: "q" }, "Older"),
    ];
    renderCards();

    const [eventSelect, projectSelect] = await screen.findAllByRole("combobox");

    expect(await within(eventSelect).findByRole("option", { name: "Event b" })).toBeInTheDocument();
    expect(await within(projectSelect).findByRole("option", { name: "Project q" })).toBeInTheDocument();
  });

  it("goes back to the first page when a filter changes", async () => {
    mockState.meetings = [
      ...meetings(PAGE_SIZE, { event_id: "a" }, "Recent"),
      ...meetings(PAGE_SIZE + 1, { event_id: "b", project_id: "q" }, "Older"),
    ];
    renderCards();

    await screen.findByText("Page 1 of 3");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 3 of 3");

    const [eventSelect, projectSelect] = screen.getAllByRole("combobox");
    await within(eventSelect).findByRole("option", { name: "Event b" });
    await userEvent.selectOptions(eventSelect, "b");

    expect(await screen.findByText("Older 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(mockState.getManyInputs).toContainEqual({ page: 1, eventId: "b", projectId: undefined });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 2");

    await within(projectSelect).findByRole("option", { name: "Project q" });
    await userEvent.selectOptions(projectSelect, "q");

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(mockState.getManyInputs).toContainEqual({ page: 1, eventId: "b", projectId: "q" });
  });

  it("falls back to the last page when the only meeting on the current page is removed", async () => {
    mockState.meetings = meetings(PAGE_SIZE + 1);
    renderCards();

    await screen.findByText("Page 1 of 2");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Meeting 11")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Meeting 1")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Meeting 11")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("drops a removed meeting's event from the filter options", async () => {
    mockState.meetings = [
      ...meetings(1, { event_id: "a" }, "Keep"),
      ...meetings(1, { event_id: "b" }, "Gone"),
    ];
    renderCards();

    const [eventSelect] = await screen.findAllByRole("combobox");
    await within(eventSelect).findByRole("option", { name: "Event b" });

    const goneCard = screen.getByText("Gone 1").closest("li") as HTMLElement;
    await userEvent.click(within(goneCard).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(within(eventSelect).queryByRole("option", { name: "Event b" })).not.toBeInTheDocument(),
    );
  });
});
