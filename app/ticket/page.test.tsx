import { render, screen, waitFor } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateQRCode } from "@/lib/utils/qrcode";
import Ticket from "./page";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/lib/utils/qrcode", () => ({
  generateQRCode: jest.fn(),
}));

const mockGenerateQRCode = generateQRCode as jest.Mock;

function openTicket(query: string) {
  (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(query));
  render(<Ticket />);
}

describe("Ticket page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    mockGenerateQRCode.mockResolvedValue("data:image/png;base64,AAAA");
  });

  it("puts the signature from the emailed link into the QR code", async () => {
    openTicket("evt=event-1&usr=user-1&sig=signature");

    await waitFor(() => {
      expect(screen.getByAltText("QR Code")).toBeInTheDocument();
    });
    expect(mockGenerateQRCode).toHaveBeenCalledWith(
      "evt=event-1&usr=user-1&sig=signature",
      128
    );
  });

  it("shows no QR code for a link emailed before tickets were signed", () => {
    openTicket("evt=event-1&usr=user-1");

    expect(
      screen.getByText(/Ask the event organizer to send your ticket again/)
    ).toBeInTheDocument();
    expect(mockGenerateQRCode).not.toHaveBeenCalled();
  });
});
