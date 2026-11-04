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
  window.history.pushState({}, "", "/");
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
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login?returnUrl=%2Fdashboard"));
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
});

it("keeps a deep link's path and query in the login returnUrl", async () => {
  (usePathname as jest.Mock).mockReturnValue("/ticket");
  window.history.pushState({}, "", "/ticket?evt=1&usr=2");
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  render(<AuthProvider>Private content</AuthProvider>);
  await waitFor(() => expect(push).toHaveBeenCalledWith(`/login?returnUrl=${encodeURIComponent("/ticket?evt=1&usr=2")}`));
  expect(push).not.toHaveBeenCalledWith("/");
});

it("sends an expired session on first load to login, even though Supabase reports it as SIGNED_OUT", async () => {
  (usePathname as jest.Mock).mockReturnValue("/projects/abc");
  (supabase.auth.getSession as jest.Mock).mockReturnValue(new Promise(() => {}));
  render(<AuthProvider>Private content</AuthProvider>);
  act(() => authChanged("SIGNED_OUT", null));
  expect(push).toHaveBeenCalledWith("/login?returnUrl=%2Fprojects%2Fabc");
  expect(push).not.toHaveBeenCalledWith("/");
});

it("does not redirect signed-out visitors away from public pages", async () => {
  (usePathname as jest.Mock).mockReturnValue("/projects/public/abc");
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  render(<AuthProvider>Public content</AuthProvider>);
  await waitFor(() => expect(supabase.auth.getSession).toHaveBeenCalled());
  await act(async () => {});
  expect(push).not.toHaveBeenCalled();
});

it("sends a later signed-out visit to login after an earlier signout went home", async () => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: "member" } } }, error: null });
  const { rerender } = render(<AuthProvider>Private content</AuthProvider>);
  await screen.findByText("Private content");
  act(() => authChanged("SIGNED_OUT", null));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenLastCalledWith("/");

  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  (usePathname as jest.Mock).mockReturnValue("/feedback");
  rerender(<AuthProvider>Private content</AuthProvider>);
  await waitFor(() => expect(push).toHaveBeenLastCalledWith("/login?returnUrl=%2Ffeedback"));
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
  expect(push).toHaveBeenCalledTimes(1);
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
