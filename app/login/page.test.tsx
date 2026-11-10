import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { renderToString } from "react-dom/server";

const mockPush = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockProfileUpsert = jest.fn();
const mockResetPassword = jest.fn();
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
    from: () => ({ upsert: mockProfileUpsert }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPassword(...args),
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
  mockProfileUpsert.mockResolvedValue({ error: null });
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

  it("keeps server-rendered controls disabled until client handlers are ready", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LoginPage />);
    expect(container.querySelector("fieldset")).toHaveAttribute("disabled");
    expect(container.querySelector('[role="status"]')).toHaveTextContent("Preparing sign-in");
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("Email")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("initializes missing profiles without overwriting returning users", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: {
      id: "returning-user", email: "dev@local.test", user_metadata: {},
      created_at: "2020-01-01T00:00:00Z",
    } }, error: null });
    render(<LoginPage />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockProfileUpsert).toHaveBeenCalledWith({
      uid: "returning-user", email: "dev@local.test", display_name: "dev",
      created_at: "2020-01-01T00:00:00Z",
    }, { onConflict: "uid", ignoreDuplicates: true });
  });

  it("reports profile initialization errors without announcing successful login", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: {
      id: "new-user", email: "dev@local.test", user_metadata: {},
    } }, error: null });
    mockProfileUpsert.mockResolvedValue({ error: { message: "Unavailable" } });
    render(<LoginPage />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Error signing in. Please sign up instead or try again.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
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

describe("error and notice states (PUB-016)", () => {
  it("tells the user an account already exists, in an alert", async () => {
    mockSignUp.mockResolvedValue({ error: { code: "user_already_exists", message: "User already registered" } });
    render(<LoginPage />);
    await waitFor(() => expect(screen.getByLabelText("Email")).toBeEnabled());
    fillCredentials();
    fireEvent.click(termsCheckbox());
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists\. Sign in instead/);
  });

  it("shows the password-reset confirmation as a status notice, not an error", async () => {
    mockSearchParams = new URLSearchParams();
    mockResetPassword.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await waitFor(() => expect(screen.getByLabelText("Email")).toBeEnabled());
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(await screen.findByRole("status", { name: "" })).toHaveTextContent(/reset instructions/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows user-facing copy when the auth service is unreachable", async () => {
    mockSearchParams = new URLSearchParams();
    mockSignInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);
    await waitFor(() => expect(screen.getByLabelText("Email")).toBeEnabled());
    fillCredentials();
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/can't reach the sign-in service/);
    expect(alert).not.toHaveTextContent(/env\.local/);
  });
});
