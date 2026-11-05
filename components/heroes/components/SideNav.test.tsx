import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SideNav } from "./SideNav";
import { useNotificationData } from "@/components/layout/NotificationPopoverContent";

const mockAuth = {
  getSession: () =>
    Promise.resolve({
      data: { session: { user: { id: "user-1", email: "a@b.test" } } },
    }),
  onAuthStateChange: () => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
  signOut: jest.fn(),
};

// A raw row never carries phone_number, so reading it here must not decide the
// account menu state.
const mockFrom = () => ({
  select: () => ({
    eq: () => ({
      single: () => Promise.resolve({ data: { uid: "user-1" } }),
    }),
  }),
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
}));

jest.mock("@/app/utils/supabase/client", () => ({
  createClient: () => ({ auth: mockAuth }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
    from: () => mockFrom(),
  },
}));

jest.mock("@/components/layout/NotificationPopoverContent", () => ({
  useNotificationData: jest.fn(),
  NotificationPopoverContent: () => null,
}));

jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));

jest.mock("posthog-js", () => ({ reset: jest.fn() }));

jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({ clearReturnUrl: jest.fn() }),
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

describe("SideNav profile completion", () => {
  it("hides the warning once the shared completion check passes", async () => {
    mockNeedsCompletion(false);

    render(<SideNav />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "View profile" })
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("!")).not.toBeInTheDocument();
  });

  it("shows the warning while the profile is incomplete", async () => {
    mockNeedsCompletion(true);

    render(<SideNav />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Set up profile" })
      ).toBeInTheDocument();
    });
    expect(screen.getByText("!")).toBeInTheDocument();
  });
});
