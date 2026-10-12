"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TESTIMONIALS } from "@/lib/constants/testimonials";
import Link from "next/link";
import { useRedirect } from "@/features/user/authentication/redirect/RedirectProvider";

const supabase = createClient();

function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="inline-flex" role="img" aria-label={`${count} star rating`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
          <path
            d="M10 15.27l-5.18 3.05 1.4-5.98L1 7.97l6.09-.52L10 2.25l2.91 5.2 6.09.52-5.22 4.37 1.4 5.98z"
            fill="#944524"
          />
        </svg>
      ))}
    </div>
  );
}

// testimonial components
function useCarousel(total: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 6000);
    return () => clearInterval(id);
  }, [total]);
  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);
  return { index, setIndex, prev, next };
}

/** Desktop right-side panel */
function TestimonialPanelDesktop() {
  const { index, setIndex, prev, next } = useCarousel(TESTIMONIALS.length);
  const t = TESTIMONIALS[index];

  return (
    <aside className="relative hidden lg:flex items-center justify-center bg-sky-50 rounded-l-3xl">
      <div className="mx-auto w-full max-w-2xl px-10 py-10 text-center">
        <Stars />
        <blockquote className="mt-6 text-xl leading-8 text-slate-800">
          <span
            dangerouslySetInnerHTML={{ __html: `&ldquo;${t.quote}&rdquo;` }}
          />
        </blockquote>

        <div className="mt-8 flex flex-col items-center gap-2">
          <Image
            src={t.avatar}
            alt={t.author}
            width={56}
            height={56}
            className="rounded-full border border-slate-300"
          />
          <div className="text-sm font-semibold text-slate-900">{t.author}</div>
          <div className="text-sm text-slate-600 max-w-lg">{t.title}</div>
          {t.logo ? (
            <div className="mt-2">
              <Image
                src={t.logo}
                alt="logo"
                width={t.logoWidth}
                height={t.logoHeight}
                className="opacity-90"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex items-center justify-center gap-8">
          <button
            onClick={prev}
            aria-label="Previous"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                className={`h-2 w-2 rounded-full transition ${
                  i === index ? "bg-slate-800" : "bg-slate-400"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            aria-label="Next"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Mobile block (like your screenshot) */
function TestimonialPanelMobile() {
  const { index, setIndex, prev, next } = useCarousel(TESTIMONIALS.length);
  const t = TESTIMONIALS[index];

  return (
    <section className="lg:hidden mt-6">
      <div className="bg-sky-50 rounded-3xl px-6 py-10 text-center">
        <Stars />
        <blockquote className="mt-4 text-base leading-7 text-slate-800">
          <span
            dangerouslySetInnerHTML={{ __html: `&ldquo;${t.quote}&rdquo;` }}
          />
        </blockquote>

        <div className="mt-6 flex flex-col items-center gap-2">
          <Image
            src={t.avatar}
            alt={t.author}
            width={56}
            height={56}
            className="rounded-full border border-slate-300"
          />
          <div className="text-sm font-semibold text-slate-900">{t.author}</div>
          <div className="text-xs text-slate-600 max-w-xs">{t.title}</div>
          {t.logo ? (
            <div className="mt-2">
              <Image
                src={t.logo}
                alt="logo"
                width={t.logoWidth}
                height={t.logoHeight}
                className="opacity-90"
              />
            </div>
          ) : null}
        </div>

        {/* controls like the comp */}
        <div className="mt-8 flex items-center justify-center gap-8">
          <button
            onClick={prev}
            aria-label="Previous"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                className={`h-2 w-2 rounded-full transition ${
                  i === index ? "bg-slate-800" : "bg-slate-400"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            aria-label="Next"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* © moved below the blue card on mobile */}
      <div className="px-6 mt-4 text-xs text-slate-500 text-center lg:text-left">
        © 2025 MentorMates
      </div>
    </section>
  );
}

// auth

function LoginContent({
  onModeChange,
}: {
  onModeChange?: (isSignUp: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const { consumeReturnUrl } = useRedirect();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  useEffect(() => {
    const mode = searchParams.get("mode");
    const up = mode === "signup";
    setIsSignUp(up);
    onModeChange?.(up);
  }, [searchParams, onModeChange]);

  useEffect(() => {
    const check = async () => {
      const {
        data: { session },
        error: sErr,
      } = await supabase.auth.getSession();
      if (sErr) console.error(sErr);
      if (session) {
        router.push(consumeReturnUrl(searchParams.get("returnUrl"), "/"));
      }
    };
    check();
  }, [consumeReturnUrl, router, searchParams]);

  const syncUserProfile = async (user: User) => {
    if (!user) return null;
    const { error } = await supabase.from("user_profiles").upsert(
      {
        uid: user.id,
        email: user.email,
        display_name: user.email?.split("@")[0],
        created_at: new Date().toISOString(),
      },
      { onConflict: "uid" }
    );
    return error ?? null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const redirectTarget = consumeReturnUrl(searchParams.get("returnUrl"), "/");

    const networkErrorMessage =
      "Cannot reach Supabase. Check: 1) Supabase project not paused (Dashboard → Restore). 2) .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. 3) Restart dev server after changing env.";

    if (isSignUp) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long");
        setLoading(false);
        return;
      }

      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${cleanBaseUrl}${redirectTarget}`,
          },
        });

        if (error) {
          const errorMessage = "Error signing up. Please try again.";
          setError(errorMessage);
          setLoading(false);
          return;
        }

        setLoading(false);
        router.push(`${cleanBaseUrl}/confirmation`);
        return;
      } catch (err) {
        setError(
          String(err).includes("fetch") || err instanceof TypeError
            ? networkErrorMessage
            : err instanceof Error
              ? err.message
              : networkErrorMessage
        );
        setLoading(false);
        return;
      }
    } else {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          const errorMessage = error.message.includes("Invalid")
            ? "Invalid email or password"
            : error.message;
          setError(errorMessage);
          setLoading(false);
          return;
        }
        if (data?.user) {
          const profileError = await syncUserProfile(data.user);
          if (profileError) {
            const message =
              "Error signing in. Please sign up instead or try again.";
            setError(message);
            setLoading(false);
            return;
          }
        }
        router.push(redirectTarget);
      } catch (err) {
        setError(
          String(err).includes("fetch") || err instanceof TypeError
            ? networkErrorMessage
            : err instanceof Error
              ? err.message
              : networkErrorMessage
        );
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${cleanBaseUrl}/auth/reset-request`,
    });
    setLoading(false);
    setError(
      error ? error.message : "Password reset instructions sent to your email!"
    );
  };

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setLoading(true);
    const redirectTarget = consumeReturnUrl(searchParams.get("returnUrl"), "/");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${cleanBaseUrl}/auth/callback?returnUrl=${encodeURIComponent(
          redirectTarget
        )}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleToggleAuthMode = () => {
    setIsSignUp((prev) => {
      const next = !prev;
      onModeChange?.(next);
      return next;
    });
    setError("");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* LEFT: form column */}
      <main className="flex flex-col h-screen">
        {/* NAV / logo */}
        <div className="flex items-center gap-3 px-6 pt-6">
          <Link href="/">
            <Image
              src="/mentormate.png"
              alt="MentorMates"
              width={180}
              height={48}
            />
          </Link>
        </div>

        {/* centered content; extra pt on mobile */}
        <div className="flex-1 flex items-start lg:items-center justify-center px-6 pt-8 lg:pt-0">
          <div className="w-full max-w-sm">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 text-center">
              Sign {isSignUp ? "Up" : "In"}
            </h1>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-auto rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600"
                />
              </div>

              <div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-auto rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600"
                />
              </div>

              {!isSignUp ? (
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-sm font-medium text-blue-700 hover:underline disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Forgot password?"}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-600">
                  Use at least 6 characters. Strong &amp; unique is best.
                </div>
              )}

              <Button
                type="submit"
                size="default"
                disabled={loading}
                className="w-full text-center"
              >
                {loading
                  ? isSignUp
                    ? "Creating account..."
                    : "Signing in..."
                  : isSignUp
                    ? "Sign Up"
                    : "Sign In"}
              </Button>

              {/* divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-sm text-slate-600">
                    or
                  </span>
                </div>
              </div>

              {/* Google */}
              <Button
                onClick={() => handleOAuthSignIn("google")}
                variant="defaultGray"
                size="default"
                className="w-full justify-center gap-3 text-slate-900"
                type="button"
              >
                {/* G icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                >
                  <path
                    d="M18.5 8.79C18.5 12.94 16.29 18 9.63 18C4.62461 18.0332 0.53852 14.0053 0.5 9C0.53852 3.99461 4.62461 -0.0332996 9.63 -3.96349e-05C11.7007 0.00764036 13.7085 0.71213 15.33 1.99996C15.442 2.09149 15.5109 2.22557 15.52 2.36996C15.5206 2.51605 15.463 2.65637 15.36 2.75996C14.709 3.35516 14.0882 3.98261 13.5 4.63996C13.3289 4.82826 13.0422 4.85432 12.84 4.69996C11.9161 4.01624 10.7888 3.66394 9.64 3.69996C6.68528 3.69996 4.29 6.09524 4.29 9.05C4.29 12.0047 6.68528 14.4 9.64 14.4C12.64 14.4 13.91 13.12 14.57 10.85H10C9.7239 10.85 9.5 10.6261 9.5 10.35V7.7C9.5 7.4238 9.7239 7.2 10 7.2H18C18.2302 7.1985 18.4244 7.3711 18.45 7.6C18.4871 7.9955 18.5038 8.3927 18.5 8.79Z"
                    fill="black"
                  />
                </svg>
                <span className="text-sm font-semibold">
                  {isSignUp ? "Sign up with Google" : "Sign in with Google"}
                </span>
              </Button>

              <p className="mt-4 text-center text-sm text-gray-700">
                {isSignUp
                  ? "Already have an account?"
                  : "Don't have an account?"}{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleToggleAuthMode();
                  }}
                  className="underline hover:text-gray-900"
                >
                  {isSignUp ? "Log in" : "Sign up"}
                </a>
              </p>
            </form>
          </div>
        </div>

        <TestimonialPanelMobile />

        <div className="px-6 pb-6 hidden lg:block">
          <div className="text-xs text-slate-500 text-center lg:text-left">
            © 2025 MentorMates
          </div>
        </div>
      </main>

      {/* RIGHT: desktop testimonial panel */}
      <TestimonialPanelDesktop />
    </div>
  );
}

// login page
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
