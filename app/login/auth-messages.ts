// User-facing copy for login/sign-up failures (PUB-016).

type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null } | null | undefined;

export const GENERIC_SIGN_UP_ERROR = "We couldn't create your account. Please try again.";

export function getSignUpErrorMessage(error: AuthErrorLike): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();

  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (code.startsWith("over_") || error?.status === 429 || message.includes("rate limit")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (code === "weak_password" || message.includes("password should")) {
    return "Choose a stronger password (at least 6 characters, mixing letters and numbers).";
  }
  if (code === "email_address_invalid" || message.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (code === "signup_disabled") {
    return "Sign-ups are currently disabled.";
  }
  return GENERIC_SIGN_UP_ERROR;
}

export function getPasswordResetErrorMessage(error: AuthErrorLike): string {
  const code = error?.code ?? "";
  if (code.startsWith("over_") || error?.status === 429) {
    return "Too many reset requests. Please wait a minute and try again.";
  }
  return "We couldn't send reset instructions. Please check the email address and try again.";
}

/** Outage copy for end users; setup hints only in development. */
export function getNetworkErrorMessage(nodeEnv: string | undefined = process.env.NODE_ENV): string {
  const userMessage = "We can't reach the sign-in service right now. Please check your connection and try again.";
  if (nodeEnv !== "development") return userMessage;
  return `${userMessage} (Dev: check that Supabase is running and .env.local has NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.)`;
}
