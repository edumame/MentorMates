import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const mockPush = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignInWithPassword = jest.fn();
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
});
