import { render, screen } from "@testing-library/react";
import { ConditionalNavbar } from "./ConditionalNavbar";
import { usePathname } from "next/navigation";
import { useLayoutConfig } from "./LayoutConfigProvider";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("./Navbar", () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

jest.mock("./LayoutConfigProvider", () => ({
  useLayoutConfig: jest.fn(),
}));

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockUsePathname = jest.mocked(usePathname);
const mockUseLayoutConfig = jest.mocked(useLayoutConfig);
const mockUseAuth = jest.mocked(useAuth);

describe("ConditionalNavbar", () => {
  beforeEach(() => {
    mockUseLayoutConfig.mockReturnValue({
      showNavbar: true,
      showPadding: true,
      showEventHeader: true,
      showEventWrapper: true,
      showFooter: true,
    });
    mockUseAuth.mockReturnValue({
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it("renders the navbar on non-home public routes when signed out", () => {
    mockUsePathname.mockReturnValue("/about");

    render(<ConditionalNavbar />);

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
  });

  it("does not render the navbar on auth routes", () => {
    mockUsePathname.mockReturnValue("/login");

    render(<ConditionalNavbar />);

    expect(screen.queryByTestId("navbar")).not.toBeInTheDocument();
  });

  it("does not render the navbar when the user is signed in", () => {
    mockUsePathname.mockReturnValue("/projects/public/demo");
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" } } as never,
      isLoading: false,
      isAuthenticated: true,
    });

    render(<ConditionalNavbar />);

    expect(screen.queryByTestId("navbar")).not.toBeInTheDocument();
  });
});
