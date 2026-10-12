"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";

interface InviteRoleTabProps {
  eventId: string;
  isArchived: boolean;
  title: string;
  placeholder: string;
  description: string;
  endpoint: string;
  ariaLabel: string;
  loadingLabel: string;
  successTitle: string;
  successDescription: (email: string, userExists: boolean) => string;
}

export function InviteRoleTab({
  eventId,
  isArchived,
  title,
  placeholder,
  description,
  endpoint,
  ariaLabel,
  loadingLabel,
  successTitle,
  successDescription,
}: InviteRoleTabProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email: trimmedEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        let errorTitle = "Error";
        let errorMessage = "Failed to send invitation";

        switch (res.status) {
          case 401:
            errorTitle = "Unauthorized";
            errorMessage = "You are not authorized to perform this action.";
            break;
          case 403:
            errorTitle = "Access Denied";
            errorMessage = "You don't have permission to invite people for this event.";
            break;
          case 400:
            errorTitle = "Invalid Request";
            errorMessage = data.error || "Please check your input and try again.";
            break;
          default:
            errorMessage = data.error || errorMessage;
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: successTitle,
        description: successDescription(trimmedEmail, Boolean(data.userExists)),
      });
      setEmail("");
    } catch {
      toast({
        title: "Network Error",
        description:
          "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-[var(--Radius-Large,16px)] border bg-card p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading && email.trim()) {
              handleInvite();
            }
          }}
          disabled={loading || isArchived}
          aria-label={ariaLabel}
          maxLength={254}
          className="min-w-0 flex-1 rounded-[12px]"
        />
        <Button
          onClick={handleInvite}
          disabled={loading || !email.trim() || isArchived}
          className="shrink-0"
        >
          {loading ? loadingLabel : "Invite"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
