import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import TermsAndConditions from "./page";

jest.mock("@/components/layout/Footer", () => ({
  Footer: () => <div data-testid="footer" />,
}));

const LAST_UPDATED = "Last updated: September 24, 2025";

describe("TermsAndConditions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(["2026-11-04T12:00:00Z", "2031-02-15T12:00:00Z"])(
    "shows the fixed revision date when viewed on %s",
    (now) => {
      jest.setSystemTime(new Date(now));

      render(<TermsAndConditions />);

      expect(
        screen.getByRole("heading", { name: "Terms & Conditions" })
      ).toBeInTheDocument();
      expect(screen.getByText(LAST_UPDATED)).toBeInTheDocument();
    }
  );

  it("hydrates prerendered HTML without a mismatch on a later day", async () => {
    jest.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(<TermsAndConditions />);

    jest.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    const onRecoverableError = jest.fn();
    const root = await act(async () =>
      hydrateRoot(container, <TermsAndConditions />, { onRecoverableError })
    );

    expect(onRecoverableError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
