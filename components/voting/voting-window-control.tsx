"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fromDateTimeLocalValue,
  getVotingWindowState,
  toDateTimeLocalValue,
  validateVotingWindow,
} from "@/features/voting/utils/voting-window";

interface VotingWindowControlProps {
  eventId: string;
}

const STATUS_LABEL = {
  open: "Voting is open",
  not_open: "Voting has not opened yet",
  closed: "Voting is closed",
} as const;

/** Organizer control for events.voting_opens_at / voting_closes_at. */
export function VotingWindowControl({ eventId }: VotingWindowControlProps) {
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [opensInput, setOpensInput] = useState("");
  const [closesInput, setClosesInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const applyWindow = useCallback((opens: string | null, closes: string | null) => {
    setOpensAt(opens);
    setClosesAt(closes);
    setOpensInput(toDateTimeLocalValue(opens));
    setClosesInput(toDateTimeLocalValue(closes));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/votes`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load voting window");
        const data = await res.json();
        if (!cancelled) applyWindow(data.votingOpensAt ?? null, data.votingClosesAt ?? null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, applyWindow]);

  const save = async (nextOpens: string | null, nextCloses: string | null) => {
    setSaved(false);
    const invalid = validateVotingWindow({ opensAt: nextOpens, closesAt: nextCloses });
    if (invalid) {
      setError(invalid);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/votes/window`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opensAt: nextOpens, closesAt: nextCloses }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update voting window");
      applyWindow(data.votingOpensAt ?? null, data.votingClosesAt ?? null);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const state = getVotingWindowState({ opensAt, closesAt });

  return (
    <Card className="p-4 border-[rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="w-5 h-5 text-[#4B89EF]" />
        <h3 className="font-semibold text-black">Voting window</h3>
        {!isLoading && (
          <span className="text-sm text-black/60" data-testid="voting-window-status">
            · {STATUS_LABEL[state.status]}
          </span>
        )}
      </div>
      <p className="text-sm text-black/60 mb-3">
        Leave a field empty for no limit. Times use your local timezone.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="voting-opens-at">Opens</Label>
          <Input
            id="voting-opens-at"
            type="datetime-local"
            value={opensInput}
            disabled={isLoading || isSaving}
            onChange={(e) => setOpensInput(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="voting-closes-at">Closes</Label>
          <Input
            id="voting-closes-at"
            type="datetime-local"
            value={closesInput}
            disabled={isLoading || isSaving}
            onChange={(e) => setClosesInput(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2" role="alert">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-sm text-green-700 mt-2">Voting window saved.</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        <Button
          size="sm"
          disabled={isLoading || isSaving}
          onClick={() =>
            save(fromDateTimeLocalValue(opensInput), fromDateTimeLocalValue(closesInput))
          }
        >
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save window
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isLoading || isSaving}
          onClick={() => {
            const now = new Date();
            // An opening time in the future would be after the close; drop it.
            const keepOpens = opensAt && new Date(opensAt) < now ? opensAt : null;
            void save(keepOpens, now.toISOString());
          }}
        >
          Close voting now
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isLoading || isSaving || (!opensAt && !closesAt)}
          onClick={() => save(null, null)}
        >
          Remove limits
        </Button>
      </div>
    </Card>
  );
}
