import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareQrDialog } from "./share-qr-dialog";

const toast = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

const URL_UNDER_TEST = "https://example.test/events/abc/overview";

function renderDialog() {
  return render(
    <ShareQrDialog
      open
      onOpenChange={jest.fn()}
      url={URL_UNDER_TEST}
      title="Share this event"
      description="Scan me"
      downloadFileName="abc-event-qr.png"
    />
  );
}

describe("ShareQrDialog", () => {
  const writeText = jest.fn();
  const write = jest.fn();
  const originalClipboardItem = (global as { ClipboardItem?: unknown }).ClipboardItem;

  beforeEach(() => {
    toast.mockClear();
    writeText.mockReset().mockResolvedValue(undefined);
    write.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText, write },
      configurable: true,
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (global as { ClipboardItem?: unknown }).ClipboardItem = originalClipboardItem;
    jest.restoreAllMocks();
  });

  it("renders the title, link and an SVG QR code", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: /share this event/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Share link")).toHaveValue(URL_UNDER_TEST);
    expect(document.querySelector("svg")).not.toBeNull();
  });

  it("copies the link", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_UNDER_TEST));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link copied" }));
  });

  it("reports a failure when the link cannot be copied", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copy failed", variant: "destructive" })
      )
    );
  });

  it("falls back to copying the link when image copy is unsupported", async () => {
    delete (global as { ClipboardItem?: unknown }).ClipboardItem;
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /copy qr/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_UNDER_TEST));
    expect(write).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Link copied instead" })
    );
  });

  it("shows an error when both QR and link copy fail", async () => {
    delete (global as { ClipboardItem?: unknown }).ClipboardItem;
    writeText.mockRejectedValue(new Error("denied"));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /copy qr/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copy failed", variant: "destructive" })
      )
    );
  });
});
