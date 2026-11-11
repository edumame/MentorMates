/**
 * @jest-environment jsdom
 */

import type { ChangeEvent, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import KeysPageClient, { type KeyEventOption } from "./keys-page-client";

// Radix Select depends on pointer APIs jsdom lacks, so use a native select.
jest.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="Event"
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const participantEvent: KeyEventOption = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Participant Event",
  eventDate: null,
};
const managedEvent: KeyEventOption = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Managed Event",
  eventDate: null,
};
const otherManagedEvent: KeyEventOption = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Other Managed Event",
  eventDate: null,
};

const fetchMock = jest.fn();

function renderPage(
  managedEventOptions: KeyEventOption[],
  participantEventOptions: KeyEventOption[]
) {
  render(
    <KeysPageClient
      initialKeys={[]}
      managedEventOptions={managedEventOptions}
      participantEventOptions={participantEventOptions}
    />
  );
}

function clickTab(name: "Participant" | "Organizer") {
  fireEvent.click(screen.getByRole("button", { name }));
}

async function createKeyAndReadBody() {
  fireEvent.click(screen.getByRole("button", { name: "Create Key" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await screen.findByRole("button", { name: "Create Key" });
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe("KeysPageClient key creation", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        api_key: "mm_sk_test",
        message: "Saved",
        key: { id: "key-1", event_id: null, prefix: "mm_sk_te", label: null, scopes: [] },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("verifies an organizer personal key against a managed event, not a participant event", async () => {
    renderPage([managedEvent], [participantEvent]);

    clickTab("Organizer");

    expect(await createKeyAndReadBody()).toMatchObject({
      event_id: managedEvent.id,
      access_mode: "organizer",
      scope_mode: "public",
    });
  });

  it("still uses a managed event after returning to the Organizer tab", async () => {
    renderPage([managedEvent], [participantEvent]);

    clickTab("Organizer");
    clickTab("Participant");
    clickTab("Organizer");

    expect((await createKeyAndReadBody()).event_id).toBe(managedEvent.id);
  });

  it("keeps the chosen managed event when moving through the Participant tab", async () => {
    renderPage([managedEvent, otherManagedEvent], [participantEvent]);

    clickTab("Organizer");
    fireEvent.click(screen.getByText("Event-specific key"));
    fireEvent.change(screen.getByLabelText("Event"), {
      target: { value: otherManagedEvent.id },
    });
    clickTab("Participant");
    clickTab("Organizer");

    expect((await createKeyAndReadBody()).event_id).toBe(otherManagedEvent.id);
  });

  it("creates an organizer key for a user with no participant events", async () => {
    renderPage([managedEvent], []);

    clickTab("Organizer");

    expect((await createKeyAndReadBody()).event_id).toBe(managedEvent.id);
  });

  it("creates a participant personal key without switching tabs", async () => {
    renderPage([managedEvent], [participantEvent]);

    expect(await createKeyAndReadBody()).toMatchObject({
      access_mode: "participant",
      scope_mode: "public",
    });
  });

  it("does not allow an organizer key without a managed event", () => {
    renderPage([], [participantEvent]);

    clickTab("Organizer");

    expect(screen.getByRole("button", { name: "Create Key" })).toBeDisabled();
  });
});
