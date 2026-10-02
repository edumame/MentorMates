import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openReport } from "shipcue/react";
import { FloatingSupportButton } from "@/components/layout/FloatingSupportButton";

let mockPathname = "/events";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("shipcue/react", () => ({ openReport: jest.fn() }));

describe("FloatingSupportButton", () => {
  beforeEach(() => {
    mockPathname = "/events";
    (openReport as jest.Mock).mockReset();
  });

  it.each([
    ["Report a Bug", "bug"],
    ["Request a Feature", "feature"],
  ])("%s opens shipcue's panel on the %s tab", async (label, type) => {
    const user = userEvent.setup();
    render(<FloatingSupportButton />);
    await user.click(screen.getByRole("button", { name: "Support" }));
    await user.click(await screen.findByRole("button", { name: new RegExp(label, "i") }));
    expect(openReport).toHaveBeenCalledWith(type);
  });

  it("keeps contact and docs in the support popover", async () => {
    const user = userEvent.setup();
    render(<FloatingSupportButton />);
    await user.click(screen.getByRole("button", { name: "Support" }));
    expect(await screen.findByText("contact@outreach.mentormates.ai")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /faq/i })).toBeInTheDocument();
  });

  it("stacks above the shipcue bubble, and higher on chat pages", () => {
    const { rerender } = render(<FloatingSupportButton />);
    expect(screen.getByRole("button", { name: "Support" })).toHaveClass("bottom-[76px]", "right-4");
    mockPathname = "/chat/1";
    rerender(<FloatingSupportButton />);
    expect(screen.getByRole("button", { name: "Support" })).toHaveClass("bottom-[172px]");
  });
});
