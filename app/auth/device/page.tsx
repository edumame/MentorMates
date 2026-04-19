"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Terminal } from "lucide-react";

const USER_CODE_RE = /^[A-Z2-9]{8}$/;

export default function DeviceAuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefilled = searchParams.get("code")?.toUpperCase().trim() || "";

  const [code, setCode] = useState(prefilled);
  const [status, setStatus] = useState<
    "idle" | "checking-auth" | "submitting" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.toUpperCase().trim();

    if (!USER_CODE_RE.test(normalizedCode)) {
      setErrorMsg("Code must be 8 characters (letters and numbers).");
      setStatus("error");
      return;
    }

    if (!isSignedIn) {
      router.push(`/login?returnUrl=/auth/device?code=${normalizedCode}`);
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: normalizedCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMsg("Network error. Try again.");
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        {status === "success" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h1 className="text-2xl font-semibold text-gray-900">
              Device authorized
            </h1>
            <p className="text-gray-600">
              Your terminal is now linked to your MentorMates account. You can
              close this window.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <Terminal className="h-7 w-7 text-blue-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Link your device
              </h1>
              <p className="text-sm text-gray-600">
                Enter the code shown in your terminal to connect your AI agent
                to MentorMates.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z2-9]/g, "")
                        .slice(0, 8),
                    )
                  }
                  placeholder="ABCD2345"
                  className="h-14 text-center font-mono text-2xl tracking-[0.3em]"
                  maxLength={8}
                  autoFocus
                  disabled={status === "submitting"}
                />
              </div>

              {status === "error" && errorMsg && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}

              {isSignedIn === false && (
                <p className="text-sm text-amber-600">
                  You&apos;ll be redirected to sign in first.
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  code.length !== 8 ||
                  status === "submitting" ||
                  isSignedIn === null
                }
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authorizing...
                  </>
                ) : isSignedIn === false ? (
                  "Sign in and authorize"
                ) : (
                  "Authorize device"
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-400">
              This links your MentorMates account to an AI agent session. You
              can revoke access anytime from your API Keys page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
