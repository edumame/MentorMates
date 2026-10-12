import { render, screen } from "@testing-library/react";
import PrivacyPolicy from "./page";
import { PHONE_NUMBER_TEXT_USAGE_COPY } from "@/lib/constants/privacy";

jest.mock("@/components/layout/Footer", () => ({
  Footer: () => <div data-testid="footer" />,
}));

describe("PrivacyPolicy", () => {
  it("shows the phone number text-use disclosure", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByRole("heading", { name: "Privacy Policy" })
    ).toBeInTheDocument();
    expect(screen.getByText("Last updated: April 17, 2026")).toBeInTheDocument();
    expect(screen.getByText(PHONE_NUMBER_TEXT_USAGE_COPY)).toBeInTheDocument();
  });
});
