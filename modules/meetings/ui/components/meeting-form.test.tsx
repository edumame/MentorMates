import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeetingForm } from "./meeting-form";
import type { MeetingGetOne } from "../../types";
import { supabase } from "@/lib/supabase";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/features/user/authentication/auth/AuthContext", () => {
  const session = { user: { id: "user", email: "owner@example.test" } };
  return { useAuth: () => ({ session }) };
});
jest.mock("@/trpc/client", () => {
  const procedure = { queryOptions: jest.fn(), mutationOptions: jest.fn() };
  const trpc = { agents: { getMany: procedure }, meetings: { create: procedure, update: procedure, getOne: procedure, getMany: procedure } };
  return { useTRPC: () => trpc };
});
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { items: mockAgents } }),
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/components/command-select", () => ({
  CommandSelect: ({ options, onSelect, value, placeholder }: {
    options: { id: string; value: string; children: React.ReactNode }[];
    onSelect: (value: string) => void; value: string; placeholder: string;
  }) => <select aria-label={placeholder} value={value} onChange={event => onSelect(event.target.value)}>
    <option value="">None</option>
    {options.map(option => <option key={option.id} value={option.value}>{option.children}</option>)}
  </select>,
}));
let mockAgents: Array<{ id: string; name: string; event_id: string | null; enabled: boolean; linkedEventIds?: string[] }> = [];
const eventId = "10000000-0000-4000-8000-000000000001";
const projectId = "20000000-0000-4000-8000-000000000001";
const standaloneId = "20000000-0000-4000-8000-000000000002";
const records = [
  { id: projectId, event_id: eventId, project_name: "Event project", lead_email: "owner@example.test", teammates: [] },
  { id: standaloneId, event_id: null, project_name: "Standalone project", lead_email: "owner@example.test", teammates: [] },
];
let projectFilters: Array<[string, unknown]>;
beforeEach(() => {
  jest.clearAllMocks(); projectFilters = []; mockAgents = [];
  (supabase.from as jest.Mock).mockImplementation(table => {
    let filter: unknown = undefined;
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn((key, value) => { if (table === "projects") { filter = value; projectFilters.push([key, value]); } return query; });
    query.is = jest.fn((key, value) => { filter = value; projectFilters.push([key, value]); return query; });
    query.then = jest.fn(resolve => Promise.resolve({ data: table === "projects"
      ? records.filter(project => filter === undefined || project.event_id === filter)
      : [{ events: { event_id: eventId, event_name: "Event" } }], error: null }).then(resolve));
    return query;
  });
});
it("offers only standalone projects when no event is selected", async () => {
  render(<MeetingForm />);
  expect(await screen.findByRole("option", { name: "Standalone project" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Event project" })).not.toBeInTheDocument();
  expect(projectFilters).toContainEqual(["event_id", null]);
});
it("preserves initial editing project instead of clearing it on mount", async () => {
  render(<MeetingForm initialValues={{ id: "meeting", event_id: eventId, project_id: projectId, name: "Existing", agent_id: "agent" } as MeetingGetOne} />);
  await screen.findByRole("option", { name: "Event project" });
  expect(screen.getByRole("combobox", { name: "Select a project" })).toHaveValue(projectId);
});
it("clears the old project when event is cleared and when a new event is selected", async () => {
  render(<MeetingForm prefillValues={{ eventId, projectId }} />);
  await screen.findByRole("option", { name: "Event project" });
  fireEvent.change(screen.getByRole("combobox", { name: "Select an event" }), { target: { value: "" } });
  await screen.findByRole("option", { name: "Standalone project" });
  const projectSelect = screen.getByRole("combobox", { name: "Select a project" });
  expect(projectSelect).toHaveValue("");
  fireEvent.change(projectSelect, { target: { value: standaloneId } });
  expect(projectSelect).toHaveValue(standaloneId);
  fireEvent.change(screen.getByRole("combobox", { name: "Select an event" }), { target: { value: eventId } });
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Select a project" })).toHaveValue(""));
  expect(await screen.findByRole("option", { name: "Event project" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Standalone project" })).not.toBeInTheDocument();
});

it("clears an incompatible event agent only on event change", async () => {
  mockAgents = [{ id: "event-agent", name: "Event Agent", event_id: eventId, enabled: true }];
  render(<MeetingForm prefillValues={{ eventId, agentId: "event-agent" }} />);
  await screen.findByRole("option", { name: "Event project" });
  expect(screen.getByRole("combobox", { name: "Select an agent" })).toHaveValue("event-agent");
  fireEvent.change(screen.getByRole("combobox", { name: "Select an event" }), { target: { value: "" } });
  await screen.findByRole("option", { name: "Standalone project" });
  expect(screen.getByRole("combobox", { name: "Select an agent" })).toHaveValue("");
  // Returning to the event must not revive an obsolete hidden form value.
  fireEvent.change(screen.getByRole("combobox", { name: "Select an event" }), { target: { value: eventId } });
  await screen.findByRole("option", { name: "Event project" });
  expect(screen.getByRole("combobox", { name: "Select an agent" })).toHaveValue("");
});
it.each(["global", "linked"])("preserves a compatible %s agent on event change", async mode => {
  mockAgents = [{ id: "compatible-agent", name: "Compatible Agent", event_id: mode === "global" ? null : "another-event", enabled: true, linkedEventIds: [eventId] }];
  render(<MeetingForm prefillValues={{ agentId: "compatible-agent" }} />);
  await screen.findByRole("option", { name: "Standalone project" });
  fireEvent.change(screen.getByRole("combobox", { name: "Select an event" }), { target: { value: eventId } });
  await screen.findByRole("option", { name: "Event project" });
  expect(screen.getByRole("combobox", { name: "Select an agent" })).toHaveValue("compatible-agent");
});
it("does not erase initial selection when agent results temporarily disappear", async () => {
  mockAgents = [{ id: "event-agent", name: "Event Agent", event_id: eventId, enabled: true }];
  const props = { prefillValues: { eventId, agentId: "event-agent" } };
  const { rerender } = render(<MeetingForm {...props} />);
  await screen.findByRole("option", { name: "Event project" });
  mockAgents = []; rerender(<MeetingForm {...props} />);
  mockAgents = [{ id: "event-agent", name: "Event Agent", event_id: eventId, enabled: true }];
  rerender(<MeetingForm {...props} />);
  expect(screen.getByRole("combobox", { name: "Select an agent" })).toHaveValue("event-agent");
});
