import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthNavbar } from "./AuthNavbar";
import { supabase } from "@/lib/supabase";

jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("./AuthNavbarRight", () => ({ AuthNavbarRight: () => null }));
jest.mock("posthog-js", () => ({ __esModule: true, default: { reset: jest.fn() } }));
jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({ clearReturnUrl: jest.fn() }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: "member" } } } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const originalLocation = window.location;
const assign = jest.fn();
const reload = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  // @ts-expect-error jsdom's location is read-only, so swap it for a stub.
  delete window.location;
  // @ts-expect-error partial stub of Location.
  window.location = { assign, reload };
});

afterEach(() => {
  // @ts-expect-error restores the original object.
  window.location = originalLocation;
});

it("signs out with a full navigation home, so a protected page is never reloaded signed out", async () => {
  render(<AuthNavbar />);
  fireEvent.click(screen.getByLabelText("Toggle menu"));
  fireEvent.click(await screen.findByText(/sign out/i));

  await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
});
