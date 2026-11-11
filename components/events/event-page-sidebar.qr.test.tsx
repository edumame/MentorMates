import { fireEvent, render, screen } from "@testing-library/react";
import { EventPageSidebar } from "./event-page-sidebar";

jest.mock("./ActiveRoleContext", () => ({ useActiveRole: () => ({ activeRole: null }) }));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="event-qr">{value}</div>,
}));

describe("EventPageSidebar QR button", () => {
  it("does not render the QR dialog until the button is clicked", () => {
    render(<EventPageSidebar eventResources={[]} eventId="event-1" eventSlug="demo" />);
    expect(screen.queryByTestId("event-qr")).not.toBeInTheDocument();
  });

  it("opens a QR code that encodes the event id so it survives slug renames", async () => {
    render(<EventPageSidebar eventResources={[]} eventId="event-1" eventSlug="demo" />);

    fireEvent.click(screen.getByRole("button", { name: "Show QR code" }));

    expect(await screen.findByTestId("event-qr")).toHaveTextContent(
      `${window.location.origin}/events/event-1/overview`
    );
    expect(screen.getByRole("button", { name: /copy qr/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download png/i })).toBeInTheDocument();
  });
});
