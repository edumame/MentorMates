"use client";

/**
 * RoundsEditor — minimal organizer UI for multi-round judging (#706).
 *
 * Manages the `rounds` array and `activeRound` inside an event's
 * `scoring_config`. Organizers can add/remove rounds, rename them, set an
 * `advancement_count`, pick the active round, and trigger advancement to the
 * next round via POST /api/events/[eventId]/rounds/advance.
 *
 * Designed as a drop-in panel inside the event-settings flow. Keeps its own
 * local state and persists on "Save".
 */

import { useMemo, useState } from "react";
import { Plus, Trash2, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { EventScoringConfig, RoundConfig } from "@/lib/types";

interface RoundsEditorProps {
  eventId: string;
  scoringConfig: EventScoringConfig;
  onSaved?: (next: EventScoringConfig) => void;
}

const DEFAULT_ROUND: RoundConfig = {
  round_number: 1,
  name: "Round 1",
  advancement_count: null,
};

export function RoundsEditor({
  eventId,
  scoringConfig,
  onSaved,
}: RoundsEditorProps) {
  const initialRounds = useMemo<RoundConfig[]>(
    () =>
      scoringConfig.rounds && scoringConfig.rounds.length > 0
        ? [...scoringConfig.rounds].sort(
            (a, b) => a.round_number - b.round_number
          )
        : [DEFAULT_ROUND],
    [scoringConfig.rounds]
  );
  const [rounds, setRounds] = useState<RoundConfig[]>(initialRounds);
  const [activeRound, setActiveRound] = useState<number>(
    scoringConfig.activeRound && scoringConfig.activeRound > 0
      ? scoringConfig.activeRound
      : 1
  );
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const addRound = () => {
    const nextNumber =
      rounds.length > 0
        ? Math.max(...rounds.map((r) => r.round_number)) + 1
        : 1;
    setRounds((prev) => [
      ...prev,
      {
        round_number: nextNumber,
        name: `Round ${nextNumber}`,
        advancement_count: null,
      },
    ]);
  };

  const removeRound = (roundNumber: number) => {
    if (rounds.length <= 1) return;
    setRounds((prev) => prev.filter((r) => r.round_number !== roundNumber));
    if (activeRound === roundNumber) setActiveRound(1);
  };

  const updateRound = (roundNumber: number, patch: Partial<RoundConfig>) => {
    setRounds((prev) =>
      prev.map((r) =>
        r.round_number === roundNumber ? { ...r, ...patch } : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const next: EventScoringConfig = {
        ...scoringConfig,
        rounds,
        activeRound,
      };
      const { error } = await supabase
        .from("events")
        .update({ scoring_config: next })
        .eq("event_id", eventId);
      if (error) throw error;
      toast({ title: "Rounds saved" });
      onSaved?.(next);
    } catch (err) {
      console.error("Failed to save rounds", err);
      toast({
        title: "Error",
        description: "Could not save rounds configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async (fromRound: number) => {
    setAdvancing(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/rounds/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromRound }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Advance failed");
      toast({
        title: `Advanced ${json.advancedCount} project(s) to round ${json.toRound}`,
      });
    } catch (err) {
      console.error("Advance failed", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Could not advance round.",
        variant: "destructive",
      });
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Judging Rounds</h3>
          <p className="text-sm text-muted-foreground">
            Configure multi-round judging. Top-K projects advance between rounds.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addRound} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add round
        </Button>
      </div>

      <div className="space-y-3">
        {rounds.map((round) => {
          const isActive = activeRound === round.round_number;
          return (
            <div
              key={round.round_number}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium w-20">
                  Round {round.round_number}
                </span>
                <Input
                  value={round.name}
                  onChange={(e) =>
                    updateRound(round.round_number, { name: e.target.value })
                  }
                  placeholder="Round name"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setActiveRound(round.round_number)}
                >
                  {isActive ? "Active" : "Set active"}
                </Button>
                {rounds.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRound(round.round_number)}
                    aria-label="Remove round"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-44">
                  Advance top
                </label>
                <Input
                  type="number"
                  min={1}
                  value={round.advancement_count ?? ""}
                  onChange={(e) =>
                    updateRound(round.round_number, {
                      advancement_count: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                  placeholder="All (final round)"
                  className="w-40"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdvance(round.round_number)}
                  disabled={advancing}
                >
                  <ArrowRightCircle className="w-4 h-4 mr-1" />
                  Advance to round {round.round_number + 1}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save rounds"}
        </Button>
      </div>
    </Card>
  );
}
