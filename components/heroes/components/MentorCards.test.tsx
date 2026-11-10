import { render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { MentorCards } from "./MentorCards";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { meetingsRouter } from "@/modules/meetings/server/procedures";
import { createCallerFactory } from "@/trpc/init";

// trpc/init wraps its context in the RSC-only React.cache.
jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock("@/lib/stream-video", () => ({ streamVideo: {} }));
jest.mock("@/lib/stream-chat", () => ({ streamChat: {} }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn(async () => ({ data: { user: null } })) },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));
// MentorCards only fires getMany for signed-in viewers.
jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
jest.mock("@/lib/hooks/use-confirm",() => ({ useConfirm: () => [() => null, jest.fn()] }));
jest.mock("@/modules/meetings/ui/components/update-meeting-dialog", () => ({ UpdateMeetingDialog: () => null }));
jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    meetings: {
      getMany: { queryOptions: jest.fn(() => ({})) },
      getFilterOptions: { queryOptions: jest.fn(() => ({})) },
      remove: { mutationOptions: jest.fn(() => ({})) },
    },
  }),
}));
jest.mock("@tanstack/react-query", () => ({
  keepPreviousData: jest.fn(),
  useMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

const PROMPT = "Please select a project to start the session";

type Row = Record<string, unknown>;

/** Resolves every query in the chain with the rows for that table, like PostgREST. */
const supabaseWith = (tables: Record<string, Row[]>) => ({
  auth: { getUser: jest.fn(async () => ({ data: { user: { id: "user-1" } } })) },
  from: (table: string) => {
    const result = { data: tables[table], error: null, count: tables[table].length };
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      ilike: () => builder,
      order: () => builder,
      range: () => builder,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  },
});

const getManyFor = (meeting: Row, agent: Row) => {
  (createSupabaseClient as jest.Mock).mockResolvedValue(
    supabaseWith({
      meetings: [{ id: "meeting-1", name: "TODO: Pitch", agent_id: "agent-1", ...meeting }],
      agents: [{ id: "agent-1", name: "Mentor", avatar_url: null, ...agent }],
    })
  );
  return createCallerFactory(meetingsRouter)({ userId: "user-1" }).getMany({});
};

/** Renders the card from the real getMany output so the server projection is covered. */
const renderCard = async (meeting: Row, agent: Row) => {
  const data = await getManyFor(meeting, agent);
  (useQuery as jest.Mock).mockReturnValue({ data, refetch: jest.fn(), isPending: false, isError: false });
  render(<MentorCards />);
};

const expectGated = () => {
  expect(screen.getByText(PROMPT)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Start Call" })).not.toBeInTheDocument();
};

const expectOpen = () => {
  expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/chat/meeting-1");
  expect(screen.getByRole("link", { name: "Start Call" })).toHaveAttribute("href", "/call/meeting-1");
};

describe("meetings.getMany agent hydration", () => {
  it.each([true, false])("keeps requires_project=%s on the agent", async (requiresProject) => {
    const { items } = await getManyFor({ status: "upcoming" }, { requires_project: requiresProject });
    expect(items[0].agent?.requires_project).toBe(requiresProject);
  });

  it("does not leak other agent columns onto the list payload", async () => {
    const { items } = await getManyFor({ status: "upcoming" }, { requires_project: true, instructions: "secret" });
    expect(items[0].agent).toEqual({ id: "agent-1", name: "Mentor", avatar_url: null, requires_project: true });
  });

  it("returns null when the column is missing from the row", async () => {
    const { items } = await getManyFor({ status: "upcoming" }, {});
    expect(items[0].agent?.requires_project).toBeNull();
  });
});

describe("MentorCards project gating", () => {
  it("blocks an auto-created upcoming meeting with no project", async () => {
    await renderCard({ status: "upcoming", project_id: null }, { requires_project: true });
    expectGated();
  });

  it("blocks Start Call on an active meeting with no project", async () => {
    await renderCard({ status: "active", project_id: null }, { requires_project: true });
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start Call" })).not.toBeInTheDocument();
  });

  it("opens the session once a project is selected", async () => {
    await renderCard({ status: "upcoming", project_id: "project-1" }, { requires_project: true });
    expectOpen();
  });

  it.each([
    ["does not require a project", { requires_project: false }],
    ["has a null requires_project", { requires_project: null }],
    ["has no requires_project column", {}],
  ])("stays open when the agent %s", async (_label, agent) => {
    await renderCard({ status: "upcoming", project_id: null }, agent);
    expectOpen();
  });

  it("shows no prompt on a completed meeting with no project", async () => {
    await renderCard({ status: "completed", project_id: null }, { requires_project: true });
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });
});
