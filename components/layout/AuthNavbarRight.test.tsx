import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthNavbarRight } from "./AuthNavbarRight";
import { useNotificationData } from "./NotificationPopoverContent";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: "user-1", email: "a@b.test" } } },
        }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signOut: jest.fn(),
    },
    // A raw row never carries phone_number, so reading it here must not decide
    // the account menu state.
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { uid: "user-1" } }),
        }),
      }),
    }),
  },
}));

jest.mock("./NotificationPopoverContent", () => ({
  useNotificationData: jest.fn(),
}));

jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));

jest.mock("posthog-js", () => ({ reset: jest.fn() }));

jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({
    clearReturnUrl: jest.fn(),
    setReturnUrlFromCurrentLocation: jest.fn(),
  }),
}));

jest.mock("@/components/ui/dropdown-menu", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    DropdownMenu: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuItem: Passthrough,
    DropdownMenuSeparator: Passthrough,
    DropdownMenuTrigger: Passthrough,
  };
});

const mockUseNotificationData = jest.mocked(useNotificationData);

function mockNeedsCompletion(needsProfileCompletion: boolean) {
  mockUseNotificationData.mockReturnValue({
    session: null,
    userProfile: null,
    needsProfileCompletion,
    missingProfileFields: [],
  });
}

describe("AuthNavbarRight", () => {
  it("offers View profile once the shared completion check passes", async () => {
    mockNeedsCompletion(false);

    render(<AuthNavbarRight />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "View profile" })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Set up profile" })
    ).not.toBeInTheDocument();
  });

  it("offers Set up profile while the profile is incomplete", async () => {
    mockNeedsCompletion(true);

    render(<AuthNavbarRight />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Set up profile" })
      ).toBeInTheDocument();
    });
  });
});
