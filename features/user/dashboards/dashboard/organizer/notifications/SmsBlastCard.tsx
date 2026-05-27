"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface SmsBlastCardProps {
  eventId: string;
}

interface BlastStatus {
  can_send: boolean;
  next_available_at: string | null;
  cooldown_ms: number;
  last_blast: { created_at: string; recipient_count: number } | null;
  recipient_count: number;
}

const MAX_LENGTH = 320;

export function SmsBlastCard({ eventId }: SmsBlastCardProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<BlastStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/sms-blast`);
      if (!res.ok) throw new Error("Failed to load blast status");
      setStatus(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/sms-blast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send blast");
      toast({
        title: "SMS blast sent",
        description: `Delivered to ${data.sent}/${data.attempted} recipients`,
      });
      setMessage("");
      await refresh();
    } catch (err) {
      toast({
        title: "Could not send SMS",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  const cooldownMessage = status?.next_available_at
    ? `Available again ${new Date(status.next_available_at).toLocaleString()}`
    : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">SMS blast</h3>
          <p className="text-sm text-gray-600">
            Text every event member with a verified phone number. Limited to one
            blast every 6 hours.
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium">
            {loading ? "…" : status?.recipient_count ?? 0} recipients
          </div>
          {cooldownMessage && (
            <div className="text-xs text-amber-600">{cooldownMessage}</div>
          )}
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
        rows={4}
        placeholder="Quick update for everyone (e.g. 'Lunch is here in the main hall')"
        className="w-full rounded-xl border border-black/15 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4b89ef]/30"
        disabled={sending || !status?.can_send}
      />

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{message.length}/{MAX_LENGTH} chars</span>
        {status?.last_blast && (
          <span>
            Last sent {new Date(status.last_blast.created_at).toLocaleString()}{" "}
            ({status.last_blast.recipient_count} delivered)
          </span>
        )}
      </div>

      <Button
        onClick={handleSend}
        disabled={
          sending ||
          loading ||
          !status?.can_send ||
          !message.trim() ||
          (status?.recipient_count ?? 0) === 0
        }
        className="bg-[#4b89ef] hover:bg-[#3d7ce0] text-white"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" /> Send blast
          </>
        )}
      </Button>
    </div>
  );
}
