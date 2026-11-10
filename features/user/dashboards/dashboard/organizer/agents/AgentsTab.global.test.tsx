import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentsTab } from "./AgentsTab";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const mockRpc = jest.fn();

function mockQueryBuilder() {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) query[method] = jest.fn(() => query);
  query.maybeSingle = jest.fn(async () => ({ data: null, error: null }));
  query.then = (resolve: (value: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [], error: null });
  return query;
}

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => mockQueryBuilder(),
  },
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    agents: {
      getMany: {
        queryOptions: () => ({
          queryKey: ["agents"],
          queryFn: async () => ({ items: [], total: 0, totalPages: 0 }),
        }),
        queryKey: () => ["agents"],
      },
      update: { mutationOptions: (options: object) => options },
      remove: { mutationOptions: (options: object) => options },
      linkToEvents: { mutationOptions: (options: object) => options },
      unlinkFromEvents: { mutationOptions: (options: object) => options },
      updateEventSessionCaps: { mutationOptions: (options: object) => options },
    },
  }),
}));

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: USER_ID } } }),
}));

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/hooks/use-confirm", () => ({
  useConfirm: () => [() => null, jest.fn(async () => true)],
}));
jest.mock("@/modules/agents/ui/components/new-agent-dialog", () => ({ NewAgentDialog: () => null }));
jest.mock("@/modules/agents/ui/components/update-agent-dialog", () => ({ UpdateAgentDialog: () => null }));
jest.mock("@/modules/meetings/ui/components/meeting-form", () => ({ MeetingForm: () => null }));

function renderTab(eventId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentsTab eventId={eventId} />
    </QueryClientProvider>
  );
}

describe("AgentsTab add agent access", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("does not offer a global agent to a non-admin outside an event", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    renderTab();

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("is_admin_user", { user_id: USER_ID }));
    expect((await screen.findAllByText(/open the Agents tab of an event you manage/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /add agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add your first agent/i })).not.toBeInTheDocument();
  });

  it("hides the control when the admin check fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("rpc unavailable") });

    renderTab();

    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /add agent/i })).not.toBeInTheDocument();
  });

  it("offers it to a platform admin outside an event", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    renderTab();

    expect(await screen.findByRole("button", { name: /^add agent$/i })).toBeInTheDocument();
  });

  it("offers it inside an event without an admin check", async () => {
    renderTab(EVENT_ID);

    expect(await screen.findByRole("button", { name: /^add agent$/i })).toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
