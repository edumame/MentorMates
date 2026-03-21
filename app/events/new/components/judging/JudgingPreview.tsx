"use client";

import { Scale, Trophy, Tag } from "lucide-react";
import type { WizardStepProps } from "@/lib/types/wizard";

export function JudgingPreview({
  event,
}: {
  event: WizardStepProps["event"];
}) {
  const tracks = event.tracks;

  if (tracks.length === 0) {
    return (
      <div className="mx-auto flex max-w-[900px] flex-col items-center gap-6 rounded-3xl border border-dashed border-[#D7DCE4] bg-[#F8FAFD] px-4 py-10 text-center sm:px-8 sm:py-16">
        <Scale className="h-10 w-10 text-[#4B89EF]" />
        <h2 className="font-geist text-[28px] font-semibold leading-[1.3] tracking-[-0.04em] text-black">
          No tracks configured
        </h2>
        <p className="max-w-[540px] text-[15px] text-[rgba(0,0,0,0.68)]">
          Switch to Edit mode to add tracks and judging criteria, then come back
          to preview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{tracks.length}</p>
          <p className="text-xs text-gray-500 mt-1">
            Track{tracks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {tracks.reduce((sum, t) => sum + t.criteria.length, 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total Criteria</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {tracks.reduce((sum, t) => sum + t.prizes.length, 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total Prizes</p>
        </div>
      </div>

      {/* Track cards */}
      {tracks.map((track) => {
        const totalWeight = track.criteria.reduce(
          (sum, c) => sum + c.weight,
          0
        );

        return (
          <div
            key={track.client_id}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            {/* Track header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <Tag className="size-5 text-[#4B89EF]" />
                <div>
                  <h3 className="font-geist font-semibold tracking-[-0.04em] text-gray-900">
                    {track.name || "Untitled Track"}
                  </h3>
                  {track.description && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {track.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Criteria */}
              {track.criteria.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Scoring Criteria
                  </h4>
                  <div className="space-y-2">
                    {track.criteria.map((crit) => {
                      const pct =
                        totalWeight > 0
                          ? Math.round((crit.weight / totalWeight) * 100)
                          : 0;
                      return (
                        <div
                          key={crit.id}
                          className="flex items-center gap-3 py-1.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {crit.name}
                            </p>
                            {crit.description && (
                              <p className="text-xs text-gray-500 truncate">
                                {crit.description}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 inline-flex items-center rounded-full bg-[#4B89EF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4B89EF]">
                            {pct}%
                          </span>
                          <span className="shrink-0 text-xs text-gray-400 font-mono">
                            {crit.min}-{crit.max}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Prizes */}
              {track.prizes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Prizes
                  </h4>
                  <div className="space-y-2">
                    {track.prizes.map((prize) => (
                      <div
                        key={prize.id}
                        className="flex items-center gap-2"
                      >
                        <Trophy className="size-4 text-amber-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-900">
                          {prize.name}
                        </span>
                        {prize.description && (
                          <span className="text-sm text-gray-500">
                            — {prize.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
