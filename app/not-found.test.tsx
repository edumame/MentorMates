import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("offers a navigation link to the event directory", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute(
      "href",
      "/events",
    );
  });
});
