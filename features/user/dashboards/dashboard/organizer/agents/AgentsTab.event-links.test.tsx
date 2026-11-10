import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentsTab } from "./AgentsTab";

const CURRENT_USER = "user-b";
const LINKED_EVENT = { event_id: "event-linked", event_name: "Linked Hack" };
const OTHER_EVENT = { event_id: "event-other", event_name: "Other Hack" };

const toast = jest.fn();
const linkToEvents = jest.fn();
const unlinkFromEvents = jest.fn();
const updateEventSessionCaps = jest.fn();

let agents: Array<Record<string, unknown>> = [];
let mockAgentCaps: Record<string, number> = {};

jest.mock("@/lib/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "user-b" } } }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

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
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

jest.mock("@/trpc/client", () => {
  const mutation = (name: string) => ({
    mutationOptions: (options: Record<string, unknown> = {}) => ({ ...options, name }),
  });
  const trpc = {
    agents: {
      getMany: { queryOptions: () => ({ queryKey: ["agents"] }) },
      update: mutation("update"),
      remove: mutation("remove"),
      updateEventSessionCaps: mutation("updateEventSessionCaps"),
      linkToEvents: mutation("linkToEvents"),
      unlinkFromEvents: mutation("unlinkFromEvents"),
    },
  };
  return { useTRPC: () => trpc };
});

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { items: agents }, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn().mockResolvedValue(undefined) }),
  useMutation: (options: { name: string; onError?: (error: Error) => void }) => ({
    isPending: false,
    mutateAsync: async (input: unknown) => {
      const handlers: Record<string, jest.Mock> = {
        linkToEvents,
        unlinkFromEvents,
        updateEventSessionCaps,
      };
      try {
        return await handlers[options.name]?.(input);
      } catch (error) {
        options.onError?.(error as Error);
        throw error;
      }
    },
  }),
}));

jest.mock("@/lib/supabase", () => {
  const resultFor = (table: string) => {
    if (table === "user_event_roles") {
      return {
        data: [
          {
            event_id: "event-linked",
            events: { event_id: "event-linked", event_name: "Linked Hack" },
          },
          {
            event_id: "event-other",
            events: { event_id: "event-other", event_name: "Other Hack" },
          },
        ],
        error: null,
      };
    }
    if (table === "agent_events") {
      return { data: [{ event_id: "event-linked" }], error: null };
    }
    return {
      data: [{ event_id: "event-linked", session_caps: { agent_caps: mockAgentCaps } }],
      error: null,
    };
  };

  return {
    supabase: {
      from: (table: string) => {
        const result = resultFor(table);
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          order: () => chain,
          maybeSingle: async () => ({
            data: { session_caps: { agent_caps: mockAgentCaps } },
            error: null,
          }),
          then: (resolve: (value: typeof result) => unknown) => resolve(result),
        };
        return chain;
      },
    },
  };
});

function agent(userId: string) {
  return {
    id: "agent-1",
    name: "Helper",
    user_id: userId,
    // Global agent, so the linked event is a removable link, not a locked home event.
    event_id: null,
    instructions: "Help out",
    type: "mentor",
    enabled: true,
    scoring: true,
    can_edit: true,
    linkedEventIds: [LINKED_EVENT.event_id],
  };
}

async function openEventAccess() {
  const user = userEvent.setup();
  render(<AgentsTab />);
  await user.click(await screen.findByRole("button", { name: "Event access" }));
  await screen.findByRole("dialog", { name: "Manage agent availability" });
  const linked = await screen.findByRole("checkbox", { name: new RegExp(LINKED_EVENT.event_name) });
  await waitFor(() => expect(linked).toBeChecked());
  return user;
}

function eventCheckbox(eventName: string) {
  return screen.getByRole("checkbox", { name: new RegExp(eventName) });
}

function capInput(eventName: string) {
  const input = eventCheckbox(eventName).closest("label")?.querySelector("input[type='number']");
  if (!input) throw new Error(`No cap input for ${eventName}`);
  return input;
}

function saveButton() {
  return screen.getByRole("button", { name: "Save access" });
}

function lastToast() {
  return toast.mock.calls[toast.mock.calls.length - 1][0];
}

describe("AgentsTab Event access", () => {
  beforeEach(() => {
    toast.mockReset();
    linkToEvents.mockReset().mockResolvedValue({ ok: true });
    unlinkFromEvents.mockReset().mockResolvedValue({ ok: true });
    updateEventSessionCaps.mockReset().mockResolvedValue({ ok: true });
    agents = [agent(CURRENT_USER)];
    mockAgentCaps = {};
  });

  describe("when the viewer can edit an agent someone else created", () => {
    beforeEach(() => {
      agents = [agent("user-a")];
    });

    it("does not offer the link and unlink controls the server would reject", async () => {
      await openEventAccess();

      expect(eventCheckbox(OTHER_EVENT.event_name)).toBeDisabled();
      expect(eventCheckbox(LINKED_EVENT.event_name)).toBeDisabled();
      expect(screen.getByText(/only the agent's creator can add or remove events/i)).toBeInTheDocument();
    });

    it("still saves cap changes on events the agent is already linked to", async () => {
      const user = await openEventAccess();

      fireEvent.change(capInput(LINKED_EVENT.event_name), { target: { value: "5" } });
      await user.click(saveButton());

      await waitFor(() => expect(updateEventSessionCaps).toHaveBeenCalledTimes(1));
      expect(updateEventSessionCaps).toHaveBeenCalledWith({
        eventId: LINKED_EVENT.event_id,
        sessionCaps: { agent_caps: { "agent-1": 5 } },
      });
      expect(linkToEvents).not.toHaveBeenCalled();
      expect(unlinkFromEvents).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(lastToast()).toEqual({
          title: "Availability updated",
          description: "1 cap updates",
        })
      );
    });
  });

  describe("when the viewer created the agent", () => {
    it("does not show the note and leaves the event checkboxes enabled", async () => {
      await openEventAccess();

      expect(eventCheckbox(OTHER_EVENT.event_name)).toBeEnabled();
      expect(eventCheckbox(LINKED_EVENT.event_name)).toBeEnabled();
      expect(screen.queryByText(/only the agent's creator/i)).not.toBeInTheDocument();
    });

    it("reports success and closes the dialog when everything saved", async () => {
      const user = await openEventAccess();

      await user.click(eventCheckbox(OTHER_EVENT.event_name));
      await user.click(saveButton());

      await waitFor(() =>
        expect(lastToast()).toEqual({
          title: "Availability updated",
          description: "1 linked",
        })
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("shows a failure title and the reason when linking fails", async () => {
      linkToEvents.mockRejectedValue(new Error("Not authorized"));
      const user = await openEventAccess();

      await user.click(eventCheckbox(OTHER_EVENT.event_name));
      await user.click(saveButton());

      await waitFor(() =>
        expect(lastToast()).toEqual({
          title: "Availability not fully updated",
          description: "1 failed | Not authorized",
          variant: "destructive",
        })
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows a failure title when unlinking fails", async () => {
      unlinkFromEvents.mockRejectedValue(new Error("Not authorized"));
      const user = await openEventAccess();

      await user.click(eventCheckbox(LINKED_EVENT.event_name));
      await user.click(saveButton());

      await waitFor(() =>
        expect(lastToast()).toEqual({
          title: "Availability not fully updated",
          description: "1 failed | Not authorized",
          variant: "destructive",
        })
      );
      expect(updateEventSessionCaps).not.toHaveBeenCalled();
    });

    it("does not count a successful link as failed when its cap write fails", async () => {
      updateEventSessionCaps.mockRejectedValue(new Error("No permission for caps"));
      const user = await openEventAccess();

      await user.click(eventCheckbox(OTHER_EVENT.event_name));
      fireEvent.change(capInput(OTHER_EVENT.event_name), { target: { value: "3" } });
      await user.click(saveButton());

      await waitFor(() =>
        expect(lastToast()).toEqual({
          title: "Availability not fully updated",
          description: "1 linked | 1 cap updates failed | No permission for caps",
          variant: "destructive",
        })
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("does not count a successful unlink as failed when its cap cleanup fails", async () => {
      mockAgentCaps = { "agent-1": 2 };
      updateEventSessionCaps.mockRejectedValue(new Error("No permission for caps"));
      const user = await openEventAccess();

      await user.click(eventCheckbox(LINKED_EVENT.event_name));
      await user.click(saveButton());

      await waitFor(() =>
        expect(lastToast()).toEqual({
          title: "Availability not fully updated",
          description: "1 unlinked | 1 cap updates failed | No permission for caps",
          variant: "destructive",
        })
      );
    });

    it("reports a cap-only failure with a failure title", async () => {
      updateEventSessionCaps.mockRejectedValue(new Error("No permission for caps"));
      const user = await openEventAccess();

      fireEvent.change(capInput(LINKED_EVENT.event_name), { target: { value: "5" } });
      await user.click(saveButton());

      await waitFor(() =>
        expect(lastToast()).toEqual({
          title: "Availability not fully updated",
          description: "1 cap updates failed | No permission for caps",
          variant: "destructive",
        })
      );
    });
  });
});
