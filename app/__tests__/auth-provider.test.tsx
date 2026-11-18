import { act, render, screen, waitFor } from "@testing-library/react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, getLoginRedirect } from "@/features/user/authentication/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

jest.mock("next/navigation", () => ({ usePathname: jest.fn(), useRouter: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } } }));
const push = jest.fn();
const unsubscribe = jest.fn();
let authChanged: (_event: string, session: object | null) => void;
beforeEach(() => {
  jest.clearAllMocks();
  (usePathname as jest.Mock).mockReturnValue("/admin");
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

it.each(["missing", "expired"])("keeps password recovery accessible with a %s session", async (state) => {
  (usePathname as jest.Mock).mockReturnValue("/reset-password");
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: null },
    error: state === "expired" ? new Error("Session expired") : null,
  });
  await act(async () => { render(<AuthProvider>Recovery instructions</AuthProvider>); });
  expect(screen.getByText("Recovery instructions")).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
  act(() => authChanged("SIGNED_OUT", null));
  expect(screen.getByText("Recovery instructions")).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

it.each(["signed out", "error", "rejection"])("hides protected children through %s redirect", async (result) => {
  (supabase.auth.getSession as jest.Mock).mockImplementation(() => result === "rejection"
    ? Promise.reject(new Error("offline"))
    : Promise.resolve({ data: { session: null }, error: result === "error" ? new Error("invalid") : null }));
  render(<AuthProvider>Private content</AuthProvider>);
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login?returnUrl=%2Fadmin"));
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
  expect(push).toHaveBeenCalledWith("/login?returnUrl=%2Fadmin");
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

// PUB-009: public content pages and the 404 page must render for signed-out visitors.
it.each(["/license", "/learn", "/resources", "/modules", "/does-not-exist-route"])(
  "renders %s for a signed-out visitor without redirecting home",
  async (path) => {
    (usePathname as jest.Mock).mockReturnValue(path);
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    await act(async () => { render(<AuthProvider>Page content</AuthProvider>); });
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  }
);

// /modules is an exact public path, not a prefix: nothing under it is opened up.
it("does not make paths under /modules public", async () => {
  (usePathname as jest.Mock).mockReturnValue("/modules/admin");
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  await act(async () => { render(<AuthProvider>Nested content</AuthProvider>); });
  expect(screen.queryByText("Nested content")).not.toBeInTheDocument();
  expect(push).toHaveBeenCalledWith("/login?returnUrl=%2Fmodules%2Fadmin");
});

it("still redirects signed-out visitors away from real protected routes", async () => {
  (usePathname as jest.Mock).mockReturnValue("/checkin");
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  await act(async () => { render(<AuthProvider>Scanner</AuthProvider>); });
  expect(screen.queryByText("Scanner")).not.toBeInTheDocument();
  expect(push).toHaveBeenCalledWith("/login?returnUrl=%2Fcheckin");
});

describe("getLoginRedirect", () => {
  it("keeps same-origin path and query, encoded", () => {
    expect(getLoginRedirect("/events/x/team", "?tab=a&b=1")).toBe("/login?returnUrl=%2Fevents%2Fx%2Fteam%3Ftab%3Da%26b%3D1");
    expect(getLoginRedirect("/admin", "")).toBe("/login?returnUrl=%2Fadmin");
  });
  it.each(["//evil.example/x", "https://evil.example", "/\\evil.example"])("drops non-local path %p", (path) => {
    expect(getLoginRedirect(path, "")).toBe("/login");
  });
});
