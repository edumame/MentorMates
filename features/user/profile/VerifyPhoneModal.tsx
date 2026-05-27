"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Phone } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface VerifyPhoneModalProps {
  open: boolean;
  phoneNumber: string;
  // When `autoStart` is true the modal sends a code as soon as it opens
  // (used after the user types a new number and saves).
  autoStart?: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export function VerifyPhoneModal({
  open,
  phoneNumber,
  autoStart = false,
  onClose,
  onVerified,
}: VerifyPhoneModalProps) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setCode("");
      setSent(false);
      return;
    }
    if (autoStart && !sent && !sending) {
      void startVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart]);

  async function startVerify() {
    setSending(true);
    try {
      const res = await fetch("/api/phone/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      if (data.already_verified) {
        toast({ title: "Already verified", description: phoneNumber });
        onVerified();
        return;
      }
      setSent(true);
      toast({ title: "Code sent", description: `We texted ${phoneNumber}` });
    } catch (err) {
      toast({
        title: "Could not send code",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  async function checkCode() {
    if (code.trim().length < 4) return;
    setChecking(true);
    try {
      const res = await fetch("/api/phone/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Incorrect code");
      }
      toast({ title: "Phone verified", description: phoneNumber });
      onVerified();
    } catch (err) {
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-[420px] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-[#4b89ef]" />
          <h2 className="text-lg font-semibold">Verify your phone number</h2>
        </div>
        <p className="text-sm text-gray-600">
          We&apos;ll send a 6-digit code to{" "}
          <span className="font-medium text-black">{phoneNumber}</span>.
        </p>

        {!sent ? (
          <Button
            onClick={startVerify}
            disabled={sending}
            className="w-full bg-[#4b89ef] hover:bg-[#3d7ce0] text-white"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
              </>
            ) : (
              "Send code"
            )}
          </Button>
        ) : (
          <>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="Enter code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-lg tracking-widest"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={startVerify}
                disabled={sending}
                className="flex-1"
              >
                {sending ? "Resending…" : "Resend"}
              </Button>
              <Button
                onClick={checkCode}
                disabled={checking || code.trim().length < 4}
                className="flex-1 bg-[#4b89ef] hover:bg-[#3d7ce0] text-white"
              >
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="block mx-auto text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
