import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShipcueReportButton } from "@/components/layout/ShipcueReportButton";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { supabase } from "@/lib/supabase";

let mockPathname = "/events";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("@/features/user/authentication/auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn(), storage: { from: jest.fn() } } }));

const mockUseAuth = useAuth as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

const signedIn = (id = "u1") =>
  mockUseAuth.mockReturnValue({ session: { user: { id } }, isLoading: false, isAuthenticated: true });
const signedOut = () => mockUseAuth.mockReturnValue({ session: null, isLoading: false, isAuthenticated: false });

const openPanel = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /report a bug or request a feature/i }));
  return user;
};

describe("ShipcueReportButton", () => {
  beforeEach(() => {
    mockPathname = "/events";
    mockRpc.mockReset();
  });

  it("shows bug and feature tabs, the areas, and the shipcue watermark to signed-out visitors", async () => {
    signedOut();
    render(<ShipcueReportButton />);
    await openPanel();
    expect(screen.getByRole("dialog", { name: /report a bug/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^bug/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /feature request/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /agent task/i })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Judging & voting" })).toBeInTheDocument();
    expect(screen.getByText(/powered by/i)).toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("hides video for signed-out visitors, who cannot attach one", async () => {
    signedOut();
    render(<ShipcueReportButton />);
    await openPanel();
    expect(screen.queryByRole("button", { name: /attach a video/i })).not.toBeInTheDocument();
  });

  it("keeps agent tasks from signed-in non-admins", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: false, error: null });
    render(<ShipcueReportButton />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("is_admin_user", { user_id: "u1" }));
    await openPanel();
    expect(screen.queryByRole("radio", { name: /agent task/i })).not.toBeInTheDocument();
  });

  it("offers agent tasks to admins", async () => {
    signedIn("admin-1");
    mockRpc.mockResolvedValue({ data: true, error: null });
    render(<ShipcueReportButton />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    await openPanel();
    expect(await screen.findByRole("radio", { name: /agent task/i })).toBeInTheDocument();
  });

  it("marks chat pages so the button moves above the composer", () => {
    signedOut();
    mockPathname = "/chat/abc";
    const { container } = render(<ShipcueReportButton />);
    expect(container.querySelector("[data-mm-shipcue]")).toHaveAttribute("data-placement", "chat");
  });
});
