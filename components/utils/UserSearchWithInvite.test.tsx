import { fireEvent, render, screen } from "@testing-library/react";
import UserSearchWithInvite from "./UserSearchWithInvite";

jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/components/ui/event-search-input", () => ({
  EventSearchInput: ({ value, onChange }: { value: string; onChange: React.ChangeEventHandler<HTMLInputElement> }) => (
    <input aria-label="search" value={value} onChange={onChange} />
  ),
}));

describe("UserSearchWithInvite change reporting", () => {
  it("reports only the removed email, not the list seeded at mount", () => {
    const onTagsChange = jest.fn();
    render(
      <UserSearchWithInvite
        allTags={[]}
        onTagsChange={onTagsChange}
        initialTags={["Ann (ann@x.com)", "bob@x.com"]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(onTagsChange).toHaveBeenCalledWith(["bob@x.com"], {
      added: [],
      removed: ["ann@x.com"],
    });
  });
});
