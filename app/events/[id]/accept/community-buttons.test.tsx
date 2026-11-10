import { fireEvent, render, screen } from "@testing-library/react";
import { CommunityButtons } from "./community-buttons";

describe("CommunityButtons", () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it.each([
    ["Join Discord", { discordLink: "https://discord.gg/abc" }, "https://discord.gg/abc"],
    ["Join WhatsApp", { whatsappLink: "https://chat.whatsapp.com/abc" }, "https://chat.whatsapp.com/abc"],
    ["Join Discord", { discordLink: "http://discord.gg/abc" }, "http://discord.gg/abc"],
  ])("opens %s in a window with no route back to the app", (label, props, url) => {
    render(<CommunityButtons {...props} />);

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "discord.gg/abc",
    "/events/other",
    "",
  ])("renders nothing for the unsafe link %j", (link) => {
    const { container } = render(
      <CommunityButtons discordLink={link} whatsappLink={link} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("ignores a non-string link stored in the JSON column", () => {
    const link = 42 as unknown as string;

    const { container } = render(<CommunityButtons discordLink={link} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the safe button when the other link is unsafe", () => {
    render(
      <CommunityButtons
        discordLink="javascript:alert(1)"
        whatsappLink="https://chat.whatsapp.com/abc"
      />,
    );

    expect(screen.queryByRole("button", { name: "Join Discord" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Join WhatsApp" }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://chat.whatsapp.com/abc",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
