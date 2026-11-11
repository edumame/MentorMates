import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserSearchWithInvite from "./UserSearchWithInvite";

const toast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

const INVITEE = "invitee@example.com";
const PARTICIPANT = "participant@example.com";
const TEAMMATE = "teammate@example.com";

const mockInviteResponse = (ok: boolean) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => (ok ? { success: true } : { error: "Invite failed" }),
  }) as unknown as typeof fetch;
};

const renderSearch = () => {
  const onTagsChange = jest.fn();
  render(
    <UserSearchWithInvite
      allTags={[PARTICIPANT, TEAMMATE]}
      onTagsChange={onTagsChange}
      initialTags={[TEAMMATE]}
      projectId="project-1"
      enableInvite
    />
  );
  return onTagsChange;
};

const typeInSearch = (value: string) =>
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });

const invite = async (email: string) => {
  typeInSearch(email);
  fireEvent.click(screen.getByText("Send project invitation"));
  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.any(String) })
    )
  );
};

describe("UserSearchWithInvite pending invitations", () => {
  beforeEach(() => {
    toast.mockClear();
    mockInviteResponse(true);
  });

  it("shows an invited email as pending without reporting it as a team member", async () => {
    const onTagsChange = renderSearch();

    await invite(INVITEE);

    expect(await screen.findByText("Invited")).toBeInTheDocument();
    expect(screen.getByText(INVITEE)).toBeInTheDocument();
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("keeps a pending invite out of later team changes", async () => {
    const onTagsChange = renderSearch();

    await invite(INVITEE);
    await screen.findByText("Invited");

    typeInSearch("participant");
    fireEvent.click(screen.getByText(PARTICIPANT));

    expect(onTagsChange).toHaveBeenCalledTimes(1);
    expect(onTagsChange).toHaveBeenCalledWith([TEAMMATE, PARTICIPANT], {
      added: [PARTICIPANT],
      removed: [],
    });

    fireEvent.click(
      screen.getByText(TEAMMATE).querySelector("button") as HTMLButtonElement
    );

    expect(onTagsChange).toHaveBeenLastCalledWith([PARTICIPANT], {
      added: [],
      removed: [TEAMMATE],
    });
  });

  it("drops a pending invite locally without touching the team", async () => {
    const onTagsChange = renderSearch();

    await invite(INVITEE);
    const chip = (await screen.findByText("Invited")).closest(
      "span.rounded-full.bg-purple-200"
    ) as HTMLElement;

    fireEvent.click(chip.querySelector("button") as HTMLButtonElement);

    expect(screen.queryByText("Invited")).not.toBeInTheDocument();
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("does not offer a second invitation to an email that is already pending", async () => {
    renderSearch();

    await invite(INVITEE);
    await screen.findByText("Invited");

    typeInSearch(INVITEE);

    expect(
      screen.queryByText("Send project invitation")
    ).not.toBeInTheDocument();
  });

  it("adds nothing when the invitation fails", async () => {
    mockInviteResponse(false);
    const onTagsChange = renderSearch();

    await invite(INVITEE);

    expect(screen.queryByText("Invited")).not.toBeInTheDocument();
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("treats an invitee who accepted as a teammate, so removing them reaches the parent", async () => {
    const onTagsChange = jest.fn();
    const props = {
      allTags: [PARTICIPANT, TEAMMATE],
      onTagsChange,
      projectId: "project-1",
      enableInvite: true,
    };
    const { rerender } = render(
      <UserSearchWithInvite {...props} initialTags={[TEAMMATE]} />
    );

    await invite(INVITEE);
    await screen.findByText("Invited");

    // The invitee accepted and the parent now shows them in the saved team.
    rerender(<UserSearchWithInvite {...props} initialTags={[TEAMMATE, INVITEE]} />);

    fireEvent.click(
      screen.getByText(INVITEE).parentElement?.querySelector("button") as HTMLButtonElement
    );

    expect(onTagsChange).toHaveBeenLastCalledWith([TEAMMATE], {
      added: [],
      removed: [INVITEE],
    });
  });
});
