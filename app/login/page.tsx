"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const supabase = createClient();

function Stars() {
  return (
    <div className="flex items-center justify-center gap-1 text-amber-500 text-xl">
      <span>★</span>
      <span>★</span>
      <span>★</span>
      <span>★</span>
      <span>★</span>
    </div>
  );
}

function TestimonialPanel() {
  return (
    <aside className="relative hidden lg:flex items-center justify-center bg-sky-50 rounded-l-3xl">
      <div className="mx-auto w-full max-w-2xl px-10 text-center">
        <Stars />
        <blockquote className="mt-6 text-xl leading-8 text-slate-800">
          "I've been to a LOT of hackathons, both as a judge and as a hacker.
          And at the MentorMates hackathon, I saw a level of creativity and
          efficiency I'd never seen before. These devs were super pragmatic and
          responsive to feedback. They knew how to ask the right questions
          before rolling up their sleeves and getting things done."
        </blockquote>

        <div className="mt-8 flex flex-col items-center gap-2">
          <Image
            src="/avatar-quincy.png"
            alt="Quincy Larson"
            width={56}
            height={56}
            className="rounded-full border border-slate-300"
          />
          <div className="text-sm font-semibold text-slate-900">
            Quincy Larson
          </div>
          <div className="text-sm text-slate-600">
            Founder &amp; Teacher, freeCodeCamp.org
          </div>
          <div className="mt-1 text-base font-mono tracking-wide text-slate-800">
            freeCodeCamp (▲)
          </div>
        </div>

        {/* dots + arrows */}
        <div className="mt-10 flex items-center justify-center gap-8">
          <button
            aria-label="Previous"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
            <span className="h-2 w-2 rounded-full bg-slate-800 inline-block" />
            <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
          </div>
          <button
            aria-label="Next"
            className="rounded-full p-2 hover:bg-white/60 transition"
          >
            →
          </button>
        </div>
      </div>
    </aside>
  );
}

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup") {
      setIsSignUp(true);
      onModeChange?.(true);
    } else {
      setIsSignUp(false);
      onModeChange?.(false);
    }
  }, [searchParams, onModeChange]);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) console.error("Error fetching session:", sessionError);
      if (session) router.push("/login");
    };
    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const returnUrl = localStorage.getItem("returnUrl");
    if (returnUrl) localStorage.removeItem("returnUrl");
    const cleanReturnUrl =
      returnUrl && returnUrl.startsWith("/") ? returnUrl.slice(1) : returnUrl;

    if (isSignUp) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${cleanBaseUrl}/${cleanReturnUrl || ""}` },
      });

      if (error) {
        setError(
          error.message.includes("unique")
            ? "This email is already registered. Please sign in instead."
            : error.message
        );
        setLoading(false);
        return;
      }

      if (data?.user) {
        const profileError = await syncUserProfile(data.user);
        if (profileError) {
          setError("Error signing up. Please sign in instead or try again.");
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      router.push(`${cleanBaseUrl}/confirmation`);
      return;
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(
          error.message.includes("Invalid")
            ? "Invalid email or password"
            : error.message
        );
        setLoading(false);
        return;
      }
      if (data?.user) {
        const profileError = await syncUserProfile(data.user);
        if (profileError) {
          setError("Error signing in. Please sign up instead or try again.");
          setLoading(false);
          return;
        }
      }
      router.push(`${cleanBaseUrl}/${cleanReturnUrl || ""}`);
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
    if (error) setError(error.message);
    else setError("Password reset instructions sent to your email!");
  };

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setLoading(true);
    const returnUrl = localStorage.getItem("returnUrl");
    if (returnUrl) localStorage.removeItem("returnUrl");
    const cleanReturnUrl =
      returnUrl && returnUrl.startsWith("/") ? returnUrl.slice(1) : returnUrl;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${cleanBaseUrl}/auth/callback?returnUrl=${cleanReturnUrl || ""}`,
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

  const syncUserProfile = async (user: User) => {
    if (user) {
      const { error } = await supabase.from("user_profiles").upsert(
        {
          uid: user.id,
          email: user.email,
          display_name: user.email?.split("@")[0],
          created_at: new Date().toISOString(),
        },
        { onConflict: "uid" }
      );
      if (error) return error;
      return null;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/");
    });
  }, [router]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* LEFT: form */}
      <main className="flex flex-col h-screen">
        {/* top bar with logo */}
        <div className="flex items-center gap-3 px-6 pt-6">
          <Image src="/mentormate.png" alt="MentorMates" width={180} height={180} />
        </div>

        {/* centered content */}
        <div className="flex-1 flex items-center justify-center px-6">
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
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-base placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-base placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                size="lg"
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
                  <span className="bg-white px-4 text-sm text-slate-600">or</span>
                </div>
              </div>

              {/* Google button */}
              <Button
                onClick={() => handleOAuthSignIn("google")}
                variant="defaultGray"
                size="lg"
                className="w-full justify-center gap-3 text-slate-900"
                type="button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path
                    d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86 8.87028 4.75 12.0003 4.75Z"
                    fill="#EA4335"
                  />
                  <path
                    d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
                    fill="#34A853"
                  />
                </svg>
                <span className="text-sm font-semibold">Sign up with Google</span>
              </Button>

              <p className="mt-4 text-center text-sm text-slate-700">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleToggleAuthMode();
                  }}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  {isSignUp ? "Log in" : "Sign up"}
                </a>
              </p>
            </form>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 pb-6">
          <div className="text-xs text-slate-500">
            © 2025 MentorMates
          </div>
        </div>
      </main>

      {/* RIGHT: testimonial panel */}
      <TestimonialPanel />
    </div>
  );
}

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      setIsSignUp(params.get("mode") === "signup");
    };
    handleLocationChange();
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <LoginContent onModeChange={setIsSignUp} />
      </Suspense>
    </div>
  );
}
