import { render, screen } from "@testing-library/react";
import { EventPageSidebar } from "./event-page-sidebar";

jest.mock("./ActiveRoleContext", () => ({ useActiveRole: () => ({ activeRole: null }) }));

// PUB-018: icon-only share buttons need accessible names.
it("gives every share button an accessible name", () => {
  render(<EventPageSidebar eventResources={[]} eventId="event-1" eventSlug="demo" />);
  for (const name of ["Copy event link", "Show QR code", "Share on LinkedIn", "Share on X", "Share on Facebook"]) {
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  }
});
