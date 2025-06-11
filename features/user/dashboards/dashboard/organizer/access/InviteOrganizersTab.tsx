"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";

interface InviteOrganizersTabProps {
  eventId: string;
}

export function InviteOrganizersTab({ eventId }: InviteOrganizersTabProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    const trimmedEmail = email.trim();
    
    // Validate email is not empty
    if (!trimmedEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate email format
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
      const res = await fetch("/api/events/invite-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email: trimmedEmail }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Handle specific error cases
        let errorMessage = "Failed to invite organizer";
        let errorTitle = "Error";
        
        switch (res.status) {
          case 401:
            errorTitle = "Unauthorized";
            errorMessage = "You are not authorized to perform this action.";
            break;
          case 403:
            errorTitle = "Access Denied";
            errorMessage = "You don't have permission to invite organizers for this event.";
            break;
          case 404:
            errorTitle = "User Not Found";
            errorMessage = `No user found with email ${trimmedEmail}. The user must have an account first.`;
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
      } else {
        toast({ 
          title: "Organizer Invited Successfully", 
          description: `${trimmedEmail} has been granted organizer access. They can now access the organizer dashboard.`
        });
        setEmail("");
      }
    } catch (err) {
      toast({ 
        title: "Network Error", 
        description: "Unable to connect to the server. Please check your connection and try again.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Invite Organizers</h3>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Enter organizer email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && email.trim() && handleInvite()}
          disabled={loading}
          aria-label="Organizer email address"
          maxLength={254}
        />
        <Button onClick={handleInvite} disabled={loading || !email.trim()}>
          {loading ? "Inviting..." : "Invite"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Enter the email of an existing user to grant organizer access.
      </p>
    </div>
  );
}
