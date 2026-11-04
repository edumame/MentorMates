import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventRole } from "@/lib/types";
import { AssignTab } from "./index";

jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("@/lib/hooks/use-toast", () => {
  const toast = jest.fn();
  return { useToast: () => ({ toast }) };
});

const USERS = [
  { user_id: "judge-1", role: EventRole.Judge, display_name: "J1", email: "j1@x.test" },
  { user_id: "judge-2", role: EventRole.Judge, display_name: "J2", email: "j2@x.test" },
  { user_id: "mentor-1", role: EventRole.Mentor, display_name: "M1", email: "m1@x.test" },
  { user_id: "org-1", role: EventRole.Organizer, display_name: "O1", email: "o1@x.test" },
];

function mockFetch() {
  const fetchMock = jest.fn(async (url: string) => {
    const payload = url.includes("/users")
      ? { users: USERS }
      : url.includes("/project-assignments")
        ? { assignments: [] }
        : url.startsWith("/api/projects")
          ? { projects: [] }
          : { success: true };
    return { ok: true, json: async () => payload };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const autoAssignBody = (fetchMock: ReturnType<typeof mockFetch>) => {
  const call = fetchMock.mock.calls.find(
    ([url]) => url === "/api/roles/assign"
  ) as unknown as [string, RequestInit] | undefined;
  return JSON.parse(call?.[1].body as string);
};

async function confirmAutoAssign(buttonName: RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: buttonName }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
}

describe("AssignTab auto-assign", () => {
  it.each([
    ["judges", /Auto-Assign Judges \(3 available\)/],
    ["mentors", /Auto-Assign Mentors \(2 available\)/],
  ])(
    "sends includeOrganizers for %s when the toggle is on",
    async (_, buttonName) => {
      const fetchMock = mockFetch();
      render(<AssignTab eventId="event-1" />);

      await userEvent.click(
        await screen.findByRole("switch", {
          name: "Include organizers in assignment pools",
        })
      );
      await confirmAutoAssign(buttonName);

      await waitFor(() =>
        expect(autoAssignBody(fetchMock).includeOrganizers).toBe(true)
      );
    }
  );

  it("sends includeOrganizers false when the toggle is off", async () => {
    const fetchMock = mockFetch();
    render(<AssignTab eventId="event-1" />);

    await confirmAutoAssign(/Auto-Assign Judges \(2 available\)/);

    await waitFor(() =>
      expect(autoAssignBody(fetchMock).includeOrganizers).toBe(false)
    );
  });
});
