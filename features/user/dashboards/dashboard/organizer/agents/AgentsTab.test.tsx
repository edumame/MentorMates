import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AgentsTab } from "./AgentsTab";

const EVENT_X = "aaaaaaaa-0000-0000-0000-000000000001";
const EVENT_Y = "bbbbbbbb-0000-0000-0000-000000000002";
const AGENT_ID = "cccccccc-0000-0000-0000-000000000003";

let mockAgents: Array<Record<string, unknown>> = [];
let mockLinkRows: Array<{ event_id: string }> = [];
const mockLinkToEvents = jest.fn();
const mockUnlinkFromEvents = jest.fn();
const mockUpdateCaps = jest.fn();

jest.mock("@/trpc/client", () => ({
  useTRPC: () =>
    new Proxy(
      {},
      {
        get: (_target, router: string) =>
          new Proxy(
            {},
            {
              get: (_inner, procedure: string) => ({
                queryOptions: () => ({ key: `${router}.${procedure}` }),
                mutationOptions: () => ({ key: procedure }),
              }),
            }
          ),
      }
    ),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { items: mockAgents } }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (options: { key: string }) => ({
    isPending: false,
    mutateAsync: (input: unknown) => {
      if (options.key === "linkToEvents") return mockLinkToEvents(input);
      if (options.key === "unlinkFromEvents") return mockUnlinkFromEvents(input);
      if (options.key === "updateEventSessionCaps") return mockUpdateCaps(input);
      return Promise.resolve();
    },
  }),
}));

jest.mock("@/lib/supabase", () => {
  const resultFor = (table: string) => {
    if (table === "user_event_roles") {
      return {
        data: [
          { event_id: "x", events: { event_id: EVENT_X, event_name: "Event X" } },
          { event_id: "y", events: { event_id: EVENT_Y, event_name: "Event Y" } },
        ],
        error: null,
      };
    }
    if (table === "agent_events") return { data: mockLinkRows, error: null };
    return { data: [], error: null };
  };

  return {
    supabase: {
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "eq", "in", "order"]) {
          chain[method] = () => chain;
        }
        chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
        chain.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve(resultFor(table)).then(resolve);
        return chain;
      },
    },
  };
});

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "organizer-1" } } }),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/lib/hooks/use-confirm", () => ({
  useConfirm: () => [() => null, jest.fn()],
}));
jest.mock("@/modules/agents/ui/components/new-agent-dialog", () => ({
  NewAgentDialog: () => null,
}));
jest.mock("@/modules/agents/ui/components/update-agent-dialog", () => ({
  UpdateAgentDialog: () => null,
}));
jest.mock("@/modules/meetings/ui/components/meeting-form", () => ({
  MeetingForm: () => null,
}));
jest.mock("@/components/responsive-dialog", () => ({
  ResponsiveDialog: ({
    open,
    title,
    description,
    children,
  }: {
    open: boolean;
    title: string;
    description: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        {children}
      </div>
    ) : null,
}));

function agent(overrides: Record<string, unknown>) {
  return {
    id: AGENT_ID,
    name: "Helper",
    instructions: "Help",
    type: "general",
    enabled: true,
    can_edit: true,
    event_id: null,
    linkedEventIds: [],
    ...overrides,
  };
}

async function renderCard() {
  render(<AgentsTab />);
  // Event names load asynchronously and feed the card label.
  await waitFor(() => expect(screen.queryByText(/Event [0-9a-f]{8}/)).toBeNull());
}

function availabilityLabel() {
  const heading = screen.getByText("Available in");
  return heading.nextElementSibling?.textContent;
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Event access" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Manage agent availability",
  });
  await waitFor(() =>
    expect(within(dialog).queryByText("Loading existing caps...")).toBeNull()
  );
  return dialog;
}

function eventRow(dialog: HTMLElement, name: string) {
  const row = within(dialog).getByText(name).closest("label");
  if (!row) throw new Error(`No row for ${name}`);
  return row as HTMLElement;
}

describe("AgentsTab agent availability", () => {
  beforeEach(() => {
    mockAgents = [];
    mockLinkRows = [];
    mockLinkToEvents.mockReset().mockResolvedValue({ ok: true });
    mockUnlinkFromEvents.mockReset().mockResolvedValue({ ok: true });
    mockUpdateCaps.mockReset().mockResolvedValue({ ok: true });
  });

  it("does not claim a global agent is limited to the events it is linked to", async () => {
    mockAgents = [agent({ event_id: null, linkedEventIds: [EVENT_X] })];
    await renderCard();

    await waitFor(() => expect(availabilityLabel()).toContain("Event X"));
    expect(availabilityLabel()).toContain("Global (all events)");
  });

  it("tells the organizer that ticking events does not restrict a global agent", async () => {
    mockAgents = [agent({ event_id: null })];
    await renderCard();
    const dialog = await openDialog();

    expect(
      within(dialog).getByText(/does not restrict who can use it/i)
    ).toBeTruthy();
  });

  it("keeps the home event in the label when other events are linked", async () => {
    mockAgents = [agent({ event_id: EVENT_Y, linkedEventIds: [EVENT_X] })];
    await renderCard();

    await waitFor(() => expect(availabilityLabel()).toBe("Event X, Event Y"));
  });

  it("lists the home event once when it also has a link row", async () => {
    mockAgents = [agent({ event_id: EVENT_Y, linkedEventIds: [EVENT_Y] })];
    await renderCard();

    await waitFor(() => expect(availabilityLabel()).toBe("Event Y"));
  });

  it("shows the home event ticked and locked without a link row", async () => {
    mockAgents = [agent({ event_id: EVENT_Y })];
    await renderCard();
    const dialog = await openDialog();

    const homeRow = eventRow(dialog, "Event Y");
    const homeCheckbox = within(homeRow).getByRole("checkbox");
    expect(homeCheckbox.getAttribute("aria-checked")).toBe("true");
    expect((homeCheckbox as HTMLButtonElement).disabled).toBe(true);
    expect(within(homeRow).getByText("home event")).toBeTruthy();
    expect(within(homeRow).queryByText("already applied")).toBeNull();

    const otherCheckbox = within(eventRow(dialog, "Event X")).getByRole("checkbox");
    expect(otherCheckbox.getAttribute("aria-checked")).toBe("false");
    expect((otherCheckbox as HTMLButtonElement).disabled).toBe(false);
  });

  it("locks the home event even when a link row exists for it", async () => {
    mockAgents = [agent({ event_id: EVENT_Y, linkedEventIds: [EVENT_Y] })];
    mockLinkRows = [{ event_id: EVENT_Y }];
    await renderCard();
    const dialog = await openDialog();

    const homeCheckbox = within(eventRow(dialog, "Event Y")).getByRole("checkbox");
    expect(homeCheckbox.getAttribute("aria-checked")).toBe("true");
    expect((homeCheckbox as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves a home event cap without creating a redundant link row", async () => {
    mockAgents = [agent({ event_id: EVENT_Y })];
    await renderCard();
    const dialog = await openDialog();

    const capInput = within(eventRow(dialog, "Event Y")).getByRole("spinbutton");
    expect((capInput as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(capInput, { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save access" }));

    await waitFor(() => expect(mockUpdateCaps).toHaveBeenCalledTimes(1));
    expect(mockUpdateCaps).toHaveBeenCalledWith({
      eventId: EVENT_Y,
      sessionCaps: { agent_caps: { [AGENT_ID]: 5 } },
    });
    expect(mockLinkToEvents).not.toHaveBeenCalled();
    expect(mockUnlinkFromEvents).not.toHaveBeenCalled();
  });

  it("links a new event without linking or unlinking the home event", async () => {
    mockAgents = [agent({ event_id: EVENT_Y })];
    await renderCard();
    const dialog = await openDialog();

    fireEvent.click(within(eventRow(dialog, "Event X")).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save access" }));

    await waitFor(() => expect(mockLinkToEvents).toHaveBeenCalledTimes(1));
    expect(mockLinkToEvents).toHaveBeenCalledWith({
      agentId: AGENT_ID,
      eventIds: [EVENT_X],
    });
    expect(mockUnlinkFromEvents).not.toHaveBeenCalled();
  });
});
