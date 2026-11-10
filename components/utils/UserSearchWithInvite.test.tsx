import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserSearchWithInvite from "./UserSearchWithInvite";

jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));

const A = "a@x.com";
const B = "b@x.com";
const C = "c@x.com";
const INVITED = "invited@elsewhere.com";

const search = (value: string) =>
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });

const pick = (tag: string) => {
  search(tag);
  fireEvent.click(screen.getByRole("listitem"));
};

const chip = (tag: string) => screen.queryByText(tag);

const removeChip = (tag: string) => {
  const button = chip(tag)?.querySelector("button");
  if (!button) throw new Error(`No chip for ${tag}`);
  fireEvent.click(button);
};

describe("UserSearchWithInvite", () => {
  describe("when the parent changes initialTags", () => {
    it("does not bring back a teammate the parent removed when adding someone else", () => {
      const onTagsChange = jest.fn();
      const { rerender } = render(
        <UserSearchWithInvite
          allTags={[A, B]}
          initialTags={[A]}
          onTagsChange={onTagsChange}
        />
      );
      expect(chip(A)).toBeInTheDocument();

      rerender(
        <UserSearchWithInvite
          allTags={[A, B]}
          initialTags={[]}
          onTagsChange={onTagsChange}
        />
      );
      expect(chip(A)).not.toBeInTheDocument();

      pick(B);

      expect(onTagsChange).toHaveBeenCalledTimes(1);
      expect(onTagsChange).toHaveBeenCalledWith([B], { added: [B], removed: [] });
    });

    it("does not bring back a removed teammate when another chip is removed", () => {
      const onTagsChange = jest.fn();
      const { rerender } = render(
        <UserSearchWithInvite
          allTags={[A, B]}
          initialTags={[A, B]}
          onTagsChange={onTagsChange}
        />
      );

      rerender(
        <UserSearchWithInvite
          allTags={[A, B]}
          initialTags={[B]}
          onTagsChange={onTagsChange}
        />
      );
      removeChip(B);

      expect(onTagsChange).toHaveBeenCalledWith([], { added: [], removed: [B] });
    });

    it("keeps the chips in step with a parent that owns the team list", () => {
      const Parent = () => {
        const [team, setTeam] = useState([A]);
        return (
          <>
            <UserSearchWithInvite
              allTags={[A, B]}
              initialTags={team}
              onTagsChange={setTeam}
            />
            <button type="button" onClick={() => setTeam([])}>
              Remove A
            </button>
            <output data-testid="team">{team.join(",")}</output>
          </>
        );
      };
      render(<Parent />);

      fireEvent.click(screen.getByRole("button", { name: "Remove A" }));
      pick(B);

      expect(screen.getByTestId("team")).toHaveTextContent(B);
      expect(screen.getByTestId("team")).not.toHaveTextContent(A);
    });

    it("picks up relabelled tags without leaving the old label behind", () => {
      const { rerender } = render(
        <UserSearchWithInvite
          allTags={[]}
          initialTags={[A]}
          onTagsChange={jest.fn()}
        />
      );

      rerender(
        <UserSearchWithInvite
          allTags={[`Ann (${A})`]}
          initialTags={[`Ann (${A})`]}
          onTagsChange={jest.fn()}
        />
      );

      expect(chip(`Ann (${A})`)).toBeInTheDocument();
      expect(chip(A)).not.toBeInTheDocument();
    });
  });

  describe("selections the parent has not saved yet", () => {
    const inviteByEmail = async () => {
      search(INVITED);
      fireEvent.click(
        screen.getByRole("button", { name: /send project invitation/i })
      );
      await waitFor(() => expect(chip(INVITED)).toBeInTheDocument());
    };

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }) as unknown as typeof fetch;
    });

    it("is not reset by a new initialTags array with the same values", async () => {
      const props = {
        allTags: [A],
        onTagsChange: jest.fn(),
        projectId: "project-1",
        enableInvite: true,
      };
      const { rerender } = render(
        <UserSearchWithInvite {...props} initialTags={[A]} />
      );
      await inviteByEmail();

      rerender(<UserSearchWithInvite {...props} initialTags={[A]} />);

      expect(chip(INVITED)).toBeInTheDocument();
      expect(chip(A)).toBeInTheDocument();
    });

    it("keeps a pending invitation chip when the saved team changes", async () => {
      // The project page never saves invited emails to the team, so the chip
      // exists only in this component until the invitee accepts.
      const props = {
        allTags: [A, B],
        onTagsChange: jest.fn(),
        projectId: "project-1",
        enableInvite: true,
      };
      const { rerender } = render(
        <UserSearchWithInvite {...props} initialTags={[A]} />
      );
      await inviteByEmail();

      rerender(<UserSearchWithInvite {...props} initialTags={[A, B]} />);

      expect(chip(INVITED)).toBeInTheDocument();
      expect(chip(B)).toBeInTheDocument();
    });

    it("does not bring back a teammate removed while an invitation is sending", async () => {
      let finishInvite: (response: unknown) => void = () => undefined;
      global.fetch = jest.fn(
        () => new Promise((resolve) => (finishInvite = resolve))
      ) as unknown as typeof fetch;
      const onTagsChange = jest.fn();
      const props = {
        allTags: [A],
        onTagsChange,
        projectId: "project-1",
        enableInvite: true,
      };
      const { rerender } = render(
        <UserSearchWithInvite {...props} initialTags={[A]} />
      );
      search(INVITED);
      fireEvent.click(
        screen.getByRole("button", { name: /send project invitation/i })
      );

      rerender(<UserSearchWithInvite {...props} initialTags={[]} />);
      finishInvite({ ok: true, json: async () => ({}) });

      await waitFor(() => expect(onTagsChange).toHaveBeenCalledWith([INVITED], { added: [INVITED], removed: [] }));
    });

    it("keeps a second add while the first save is still in flight", () => {
      const onTagsChange = jest.fn();
      const props = { allTags: [A, B, C], onTagsChange };
      const { rerender } = render(
        <UserSearchWithInvite {...props} initialTags={[A]} />
      );
      pick(B);
      pick(C);

      rerender(<UserSearchWithInvite {...props} initialTags={[A, B]} />);

      expect(chip(C)).toBeInTheDocument();
    });

    it("drops a chip once the parent saved it and then removed it", () => {
      const onTagsChange = jest.fn();
      const props = { allTags: [A, B], onTagsChange };
      const { rerender } = render(
        <UserSearchWithInvite {...props} initialTags={[]} />
      );
      pick(B);
      rerender(<UserSearchWithInvite {...props} initialTags={[B]} />);

      rerender(<UserSearchWithInvite {...props} initialTags={[]} />);

      expect(chip(B)).not.toBeInTheDocument();
    });
  });
});

describe("UserSearchWithInvite change reporting", () => {
  it("reports only the removed email, not the whole list", () => {
    const onTagsChange = jest.fn();
    render(
      <UserSearchWithInvite
        allTags={[]}
        onTagsChange={onTagsChange}
        initialTags={["Ann (ann@x.com)", "bob@x.com"]}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(onTagsChange).toHaveBeenCalledWith(["bob@x.com"], {
      added: [],
      removed: ["ann@x.com"],
    });
  });
});
