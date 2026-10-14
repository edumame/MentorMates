import { act, render, screen, waitFor } from "@testing-library/react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider } from "@/features/user/authentication/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

jest.mock("next/navigation", () => ({ usePathname: jest.fn(), useRouter: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } } }));
const push = jest.fn();
const unsubscribe = jest.fn();
let authChanged: (_event: string, session: object | null) => void;
beforeEach(() => {
  jest.clearAllMocks();
  (usePathname as jest.Mock).mockReturnValue("/dashboard");
  (useRouter as jest.Mock).mockReturnValue({ push });
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
    authChanged = callback;
    return { data: { subscription: { unsubscribe } } };
  });
});

it("shows public children while session lookup is pending", () => {
  (usePathname as jest.Mock).mockReturnValue("/");
  (supabase.auth.getSession as jest.Mock).mockReturnValue(new Promise(() => {}));
  render(<AuthProvider>Landing content</AuthProvider>);
  expect(screen.getByText("Landing content")).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

it.each(["signed out", "error", "rejection"])("hides protected children through %s redirect", async (result) => {
  (supabase.auth.getSession as jest.Mock).mockImplementation(() => result === "rejection"
    ? Promise.reject(new Error("offline"))
    : Promise.resolve({ data: { session: null }, error: result === "error" ? new Error("invalid") : null }));
  render(<AuthProvider>Private content</AuthProvider>);
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
});

it("reveals protected children after authentication, hides them on signout, and unsubscribes", async () => {
  let resolveSession!: (value: unknown) => void;
  (supabase.auth.getSession as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
  const { unmount } = render(<AuthProvider>Private content</AuthProvider>);
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  await act(async () => { resolveSession({ data: { session: { user: { id: "member" } } }, error: null }); });
  expect(screen.getByText("Private content")).toBeInTheDocument();
  act(() => authChanged("SIGNED_OUT", null));
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  expect(push).toHaveBeenCalledWith("/");
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it("does not let an older session lookup undo signout", async () => {
  let resolveSession!: (value: unknown) => void;
  (supabase.auth.getSession as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
  render(<AuthProvider>Private content</AuthProvider>);
  act(() => authChanged("SIGNED_OUT", null));
  await act(async () => { resolveSession({ data: { session: { user: { id: "member" } } }, error: null }); });
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
});
