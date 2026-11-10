import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import EventsLoading from "./loading";

it("announces route loading with accessible decorative placeholders", async () => {
  const { container } = render(<EventsLoading />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading event content…");
  expect(container.querySelector('[aria-hidden="true"]')).toHaveClass("motion-safe:animate-pulse");
  expect(await axe(container)).toHaveNoViolations();
});
