import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarLayout } from "./SidebarLayout";

let isAuthenticated = true;

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated }),
}));
jest.mock("@/components/heroes/components/SideNav", () => ({ SideNav: () => <nav>Navigation</nav> }));
jest.mock("@/components/layout/mobile-sidebar-drawer", () => ({ MobileSidebarHeader: () => <header>Mobile navigation</header> }));

function DraftEditor() {
  const [name, setName] = React.useState("");
  return <input aria-label="Project name" value={name} onChange={(event) => setName(event.target.value)} />;
}

describe("SidebarLayout", () => {
  beforeEach(() => { isAuthenticated = true; });

  it("does not remount its page subtree when authentication changes", () => {
    const { rerender } = render(<SidebarLayout><DraftEditor /></SidebarLayout>);
    const name = screen.getByRole("textbox", { name: "Project name" });
    fireEvent.change(name, { target: { value: "Unsaved project" } });

    isAuthenticated = false;
    rerender(<SidebarLayout><DraftEditor /></SidebarLayout>);

    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveValue("Unsaved project");
    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
  });
});
