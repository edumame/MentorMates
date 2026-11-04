import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const mockPush = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockUpsert = jest.fn();
const mockFrom = jest.fn<{ upsert: jest.Mock }, [string]>(() => ({ upsert: mockUpsert }));
let mockSearchParams = new URLSearchParams("mode=signup");

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({
    consumeReturnUrl: (url: string | null, fallback: string) => url ?? fallback,
  }),
}));

jest.mock("@/app/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
    from: (table: string) => mockFrom(table),
  }),
}));

const termsCheckbox = () =>
  screen.getByRole("checkbox", { name: /I agree to the Terms of Service/i });
const marketingCheckbox = () =>
  screen.getByRole("checkbox", { name: /Send me occasional emails/i });
const termsError = () =>
  screen.queryByText(/Please accept the Terms of Service and Privacy Policy/i);

function fillCredentials() {
  fireEvent.change(screen.getByPlaceholderText("Email"), {
    target: { value: "dev@local.test" },
  });
  fireEvent.change(screen.getByPlaceholderText("Password"), {
    target: { value: "password123" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams("mode=signup");
  mockSignUp.mockResolvedValue({ error: null });
  mockSignInWithOAuth.mockResolvedValue({ error: null });
  mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

describe("sign-up consent", () => {
  it("shows unchecked terms and mailing checkboxes with policy links", async () => {
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
    expect(termsCheckbox()).not.toBeChecked();
    expect(marketingCheckbox()).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });

  it("blocks email sign-up until terms are accepted, then clears the error", async () => {
    render(<LoginPage />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(termsError()).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();

    fireEvent.click(termsCheckbox());
    expect(termsError()).not.toBeInTheDocument();
  });

  it("blocks Google sign-up until terms are accepted", async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sign up with Google/i }));
    expect(termsError()).toBeInTheDocument();
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it.each([
    [true, expect.any(String)],
    [false, null],
  ])("sends consent metadata with email sign-up (marketing=%p)", async (optIn, optInAt) => {
    render(<LoginPage />);
    fillCredentials();
    fireEvent.click(termsCheckbox());
    if (optIn) fireEvent.click(marketingCheckbox());
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp.mock.calls[0][0].options.data).toEqual({
      terms_accepted_at: expect.any(String),
      terms_version: expect.any(String),
      marketing_opt_in: optIn,
      marketing_opt_in_at: optInAt,
    });
  });

  it("passes consent through the Google OAuth callback URL", async () => {
    render(<LoginPage />);
    fireEvent.click(termsCheckbox());
    fireEvent.click(marketingCheckbox());
    fireEvent.click(screen.getByRole("button", { name: /Sign up with Google/i }));

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1));
    const redirectTo = new URL(mockSignInWithOAuth.mock.calls[0][0].options.redirectTo);
    expect(redirectTo.pathname).toBe("/auth/callback");
    expect(redirectTo.searchParams.get("returnUrl")).toBe("/");
    expect(redirectTo.searchParams.get("acceptTerms")).toBe("1");
    expect(redirectTo.searchParams.get("marketingOptIn")).toBe("1");
  });
});

describe("sign-in", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  it("does not show consent checkboxes or require them", async () => {
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /I agree/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /occasional emails/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sign in with Google/i }));
    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1));
    const redirectTo = new URL(mockSignInWithOAuth.mock.calls[0][0].options.redirectTo);
    expect(redirectTo.searchParams.has("acceptTerms")).toBe(false);
  });

  describe("profile sync after email/password sign-in", () => {
    const signIn = async () => {
      render(<LoginPage />);
      fillCredentials();
      fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalledTimes(1));
    };

    beforeEach(() => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "user-1", email: "dev@local.test" } },
        error: null,
      });
    });

    it("creates a missing profile but leaves an existing row untouched", async () => {
      await signIn();

      await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
      expect(mockFrom).toHaveBeenCalledWith("user_profiles");
      const [row, options] = mockUpsert.mock.calls[0];
      expect(row).toEqual({
        uid: "user-1",
        email: "dev@local.test",
        display_name: "dev",
        created_at: expect.any(String),
      });
      // Without ignoreDuplicates PostgREST runs ON CONFLICT DO UPDATE, which
      // would reset a chosen display_name and created_at on every sign-in.
      expect(options).toEqual({ onConflict: "uid", ignoreDuplicates: true });
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    });

    it("stops the redirect and shows an error when the profile write fails", async () => {
      mockUpsert.mockResolvedValue({ error: { message: "denied" } });
      await signIn();

      expect(await screen.findByText(/Error signing in/i)).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
