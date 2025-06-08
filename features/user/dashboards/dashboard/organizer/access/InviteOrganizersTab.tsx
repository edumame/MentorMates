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
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/events/invite-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to invite organizer",
          variant: "destructive",
        });
      } else {
        toast({ title: "Organizer Invited", description: `Invitation sent to ${email}` });
        setEmail("");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to invite organizer", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Invite Organizers</h3>
      <div className="flex gap-2">
        <Input
          placeholder="Organizer email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={handleInvite} disabled={loading || !email}>
          {loading ? "Inviting..." : "Invite"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Enter the email of an existing user to grant organizer access.
      </p>
    </div>
  );
}
