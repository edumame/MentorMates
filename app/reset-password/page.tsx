"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import { Footer } from "@/components/layout/footer";
import Image from "next/image";
import Link from "next/link";

const supabase = createClient();

function ResetPasswordContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // Check if user is already authenticated
    const checkSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Error fetching session:", sessionError);
        setError("Unable to verify your session. Please try requesting a new password reset link.");
      }
      
      // Session is checked but not used in current implementation
      // Could be used for additional validation if needed
      console.log("Session status:", session ? "active" : "inactive");
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validate passwords
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess("Password updated successfully! Redirecting to home...");
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);

    } catch (error: unknown) {
      console.error("Error updating password:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while updating your password. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md pt-5">
        <Image
          alt="MentorMates"
          src="/mentormate.png"
          width={40}
          height={40}
          className="mx-auto object-contain"
        />
        <h2 className="m-2 text-center text-2xl font-bold tracking-tight text-gray-900">
          Reset Your Password
        </h2>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-[400px] pl-5 pr-5 pb-10">
        <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
          {error && (
            <div className="mb-4 text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 text-center text-sm text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-900"
              >
                New Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:outline-indigo-600 sm:text-sm"
                  placeholder="Enter your new password"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters long
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-900"
              >
                Confirm New Password
              </label>
              <div className="mt-2">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:outline-indigo-600 sm:text-sm"
                  placeholder="Confirm your new password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="flex w-full justify-center rounded-md bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:outline-2 focus:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-blue-900 hover:text-blue-500 font-medium"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen pb-10 bg-gradient-to-b from-white to-blue-100/80 flex flex-col items-center">
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordContent />
      </Suspense>
      <Footer />
    </div>
  );
}
