import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthNavbarRight } from "@/components/layout/AuthNavbarRight";
import { SideNav } from "@/components/heroes/components/SideNav";

const mockPush = jest.fn();
const mockAuth = {
  getSession: jest.fn(() =>
    Promise.resolve({
      data: { session: { user: { id: "u1", email: "ada@example.com", user_metadata: {} } } },
    }),
  ),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
};

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null }) }),
      }),
    }),
  },
}));
jest.mock("@/app/utils/supabase/client", () => ({
  createClient: () => ({ auth: mockAuth }),
}));
jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));
jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({
    clearReturnUrl: jest.fn(),
    setReturnUrlFromCurrentLocation: jest.fn(),
  }),
}));
const mockNotificationData = { needsProfileCompletion: false };
jest.mock("@/components/layout/NotificationPopoverContent", () => ({
  useNotificationData: () => mockNotificationData,
  NotificationPopoverContent: () => null,
}));
jest.mock("posthog-js", () => ({ reset: jest.fn() }));

describe.each([
  ["AuthNavbarRight", AuthNavbarRight],
  ["SideNav", SideNav],
])("%s account menu profile action", (_name, Component) => {
  beforeAll(() => {
    // Radix's popper and roving focus use browser APIs jsdom does not implement.
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    mockPush.mockClear();
  });

  async function openMenuWithKeyboard() {
    const user = userEvent.setup();
    render(<Component />);
    (await screen.findByRole("button", { name: "Account menu" })).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    return user;
  }

  it.each([
    [false, "View profile", "/profile/u1"],
    [true, "Set up profile", "/profile/u1?edit=1"],
  ])(
    "reaches the action by keyboard when needsCompletion=%s",
    async (needsCompletion, label, href) => {
      mockNotificationData.needsProfileCompletion = needsCompletion;
      const user = await openMenuWithKeyboard();

      const item = screen.getByRole("menuitem", { name: label });
      await waitFor(() => expect(item).toHaveFocus());

      // Arrowing away and wrapping back proves it is part of the menu's focus order.
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Support" })).toHaveFocus();
      await user.keyboard("{Home}");
      expect(item).toHaveFocus();

      await user.keyboard("{Enter}");

      expect(mockPush).toHaveBeenCalledWith(href);
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    },
  );
});
