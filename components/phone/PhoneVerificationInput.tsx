"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2, CheckCircle2, AlertCircle, Phone } from "lucide-react";

export type PhoneVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed"
  | "expired"
  | null;

interface PhoneVerificationInputProps {
  phoneNumber: string;
  onPhoneChange: (value: string) => void;
  verificationStatus: PhoneVerificationStatus;
  onVerificationStatusChange: (status: PhoneVerificationStatus) => void;
  disabled?: boolean;
}

export function PhoneVerificationInput({
  phoneNumber,
  onPhoneChange,
  verificationStatus,
  onVerificationStatusChange,
  disabled = false,
}: PhoneVerificationInputProps) {
  const [otpCode, setOtpCode] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showOtpInput, setShowOtpInput] = React.useState(
    verificationStatus === "pending"
  );

  // Update showOtpInput when verificationStatus changes
  React.useEffect(() => {
    if (verificationStatus === "pending") {
      setShowOtpInput(true);
    } else if (verificationStatus === "verified") {
      setShowOtpInput(false);
      setOtpCode("");
    }
  }, [verificationStatus]);

  const handleSendVerification = async () => {
    if (!phoneNumber.trim()) {
      setError("Please enter a phone number");
      return;
    }

    // Ensure phone number is in E.164 format
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith("+")) {
      // Assume US number if no country code
      formattedPhone = "+1" + formattedPhone.replace(/\D/g, "");
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/phone/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        return;
      }

      onVerificationStatusChange("pending");
      setShowOtpInput(true);
    } catch {
      setError("Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    // Ensure phone number is in E.164 format
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+1" + formattedPhone.replace(/\D/g, "");
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/phone/check-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formattedPhone, code: otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        if (response.status === 410) {
          onVerificationStatusChange("expired");
        } else if (response.status === 429) {
          onVerificationStatusChange("failed");
        }
        return;
      }

      if (data.verified) {
        onVerificationStatusChange("verified");
        setShowOtpInput(false);
        setOtpCode("");
      }
    } catch {
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setOtpCode("");
    setError(null);
    handleSendVerification();
  };

  const getStatusBadge = () => {
    switch (verificationStatus) {
      case "verified":
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500 text-white hover:bg-amber-600">
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500 text-white hover:bg-red-600">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-gray-500 text-white hover:bg-gray-600">
            Expired
          </Badge>
        );
      case "unverified":
        return (
          <Badge variant="outline" className="text-gray-500">
            Unverified
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            placeholder="+1 555 555 5555"
            value={phoneNumber}
            onChange={(e) => onPhoneChange(e.target.value)}
            disabled={disabled || verificationStatus === "verified"}
            className="pl-10"
            maxLength={50}
          />
        </div>
        {verificationStatus && getStatusBadge()}
      </div>

      {/* Verify button for unverified/failed/expired states */}
      {phoneNumber.trim() &&
        verificationStatus !== "verified" &&
        !showOtpInput && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSendVerification}
            disabled={isLoading || disabled}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Verify Phone"
            )}
          </Button>
        )}

      {/* OTP Input for pending state */}
      {showOtpInput && (
        <div className="space-y-3 rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to your phone
          </p>
          <div className="flex items-center gap-3">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={setOtpCode}
              disabled={isLoading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              type="button"
              size="sm"
              onClick={handleVerifyCode}
              disabled={isLoading || otpCode.length !== 6}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Didn&apos;t receive the code?</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={handleResend}
              disabled={isLoading}
            >
              Resend
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
