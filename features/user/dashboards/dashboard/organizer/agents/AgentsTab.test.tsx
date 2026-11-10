import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const refetch = jest.fn();
let agentsState: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => agentsState,
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/trpc/client", () => {
  const options = () => ({ queryOptions: () => ({}), mutationOptions: () => ({}), queryKey: () => [] });
  const proxy: unknown = new Proxy({}, { get: () => new Proxy({}, { get: () => options() }) });
  return { useTRPC: () => proxy };
});
jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "org-1" } } }),
}));
jest.mock("@/lib/supabase", () => {
  const query: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit", "maybeSingle", "single"]) query[m] = () => query;
  (query as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return { supabase: { from: () => query, auth: { getSession: async () => ({ data: { session: null } }) } } };
});
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/modules/agents/ui/components/new-agent-dialog", () => ({ NewAgentDialog: () => null }));
jest.mock("@/modules/agents/ui/components/update-agent-dialog", () => ({ UpdateAgentDialog: () => null }));
jest.mock("@/modules/meetings/ui/components/meeting-form", () => ({ MeetingForm: () => null }));
jest.mock("@/components/responsive-dialog", () => ({ ResponsiveDialog: () => null }));
jest.mock("@/lib/hooks/use-confirm", () => ({ useConfirm: () => [() => null, async () => true] }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AgentsTab } = require("./AgentsTab");

beforeEach(() => {
  refetch.mockClear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock;
});

describe("AgentsTab (PUB-014)", () => {
  it("shows an error with a working Retry instead of loading forever", () => {
    agentsState = { isLoading: false, isError: true, isFetching: false, data: undefined, refetch };
    render(<AgentsTab eventId="event-1" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load agents.");
    expect(screen.queryByText("Loading agents...")).toBeNull();
    expect(screen.queryByText("No agents found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the loading state while fetching", () => {
    agentsState = { isLoading: true, isError: false, isFetching: true, data: undefined, refetch };
    render(<AgentsTab eventId="event-1" />);
    expect(screen.getByText("Loading agents...")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
