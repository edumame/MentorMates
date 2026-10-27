"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildDeviceLoginUrl } from "@/lib/agent/device-auth-url";
import { AlertTriangle, CheckCircle2, Loader2, Terminal } from "lucide-react";

const USER_CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

type Preview = {
  access_mode: "organizer" | "participant";
  scopes: string[];
  expires_at: string;
};

const ACCESS_MODE_LABELS: Record<Preview["access_mode"], string> = {
  organizer: "Organizer access: manage events you organize",
  participant: "Participant access: join events and manage your projects",
};

export default function DeviceAuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefilled = (searchParams.get("code") || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, 8);

  const [code, setCode] = useState(prefilled);
  const [status, setStatus] = useState<
    "idle" | "loading" | "review" | "submitting" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
  }, []);

  const fail = (message: string) => {
    setErrorMsg(message);
    setStatus("error");
  };

  // Step 1: look up what the code would grant, without approving it.
  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.toUpperCase().trim();

    if (!USER_CODE_RE.test(normalizedCode)) {
      fail("Code must be 8 characters (letters and numbers).");
      return;
    }

    if (!isSignedIn) {
      router.push(buildDeviceLoginUrl(normalizedCode));
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(
        `/api/auth/device/approve?user_code=${encodeURIComponent(normalizedCode)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        fail(data.error || "Something went wrong.");
        return;
      }
      setPreview(data as Preview);
      setStatus("review");
    } catch {
      fail("Network error. Try again.");
    }
  };

  // Step 2: approve after the user has seen the requested access.
  const handleApprove = async () => {
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: code.toUpperCase().trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPreview(null);
        fail(data.error || "Something went wrong.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("review");
      setErrorMsg("Network error. Try again.");
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setStatus("idle");
    setErrorMsg("");
  };

  const phishingWarning = (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Only approve a code that you started yourself in your own terminal. If
        someone sent you this code or link, do not approve it: it would give
        them access to your MentorMates account.
      </p>
    </div>
  );

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
        ) : (status === "review" || status === "submitting") && preview ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <Terminal className="h-7 w-7 text-blue-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Approve this device?
              </h1>
              <p className="font-mono text-lg tracking-[0.3em] text-gray-700">
                {code}
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">
                {ACCESS_MODE_LABELS[preview.access_mode]}
              </p>
              <p className="text-gray-600">
                The agent will receive an API key with these permissions:
              </p>
              <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-gray-700">
                {preview.scopes.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            </div>

            {phishingWarning}

            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCancel}
                disabled={status === "submitting"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleApprove}
                disabled={status === "submitting"}
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
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

            <form onSubmit={handleReview} className="space-y-4">
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
                  disabled={status === "loading"}
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

              {phishingWarning}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  code.length !== 8 ||
                  status === "loading" ||
                  isSignedIn === null
                }
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking code...
                  </>
                ) : isSignedIn === false ? (
                  "Sign in to continue"
                ) : (
                  "Continue"
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
