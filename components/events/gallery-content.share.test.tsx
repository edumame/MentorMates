import { fireEvent, render, screen } from "@testing-library/react";
import { GalleryContent } from "./gallery-content";

jest.mock("@/features/projects/components/displays/ProjectBoard/ProjectBoard", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="gallery-qr">{value}</div>
  ),
}));

describe("GalleryContent", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ projects: [] }),
    }) as jest.Mock;
  });

  it("shares a QR that keeps working after the slug is renamed", async () => {
    render(
      <GalleryContent eventId="event-123" slug="old-slug" hasJoined={false} isSignedIn={false} />
    );

    fireEvent.click(await screen.findByRole("button", { name: /share gallery/i }));

    expect(await screen.findByTestId("gallery-qr")).toHaveTextContent(
      `${window.location.origin}/events/event-123/gallery`
    );
  });
});
