"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RosterUser } from "../api/teamsClient";

interface TeammatePickerProps {
  candidates: RosterUser[];
  selectedIds: string[];
  onToggle: (uid: string) => void;
  // User ids to hide from the list (already on a team, or the current user).
  excludeIds?: string[];
  disabled?: boolean;
}

export function TeammatePicker({
  candidates,
  selectedIds,
  onToggle,
  excludeIds = [],
  disabled = false,
}: TeammatePickerProps) {
  const [query, setQuery] = useState("");

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => c.uid && !excluded.has(c.uid))
      .filter((c) =>
        q ? (c.display_name || "").toLowerCase().includes(q) : true
      );
  }, [candidates, excluded, query]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search participants…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-[rgba(0,0,0,0.12)] divide-y divide-[rgba(0,0,0,0.06)]">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-[14px] text-gray-500">
            No participants available to add.
          </p>
        ) : (
          visible.map((c) => {
            const name = c.display_name || "Anonymous Participant";
            const checked = selected.has(c.uid);
            return (
              <label
                key={c.uid}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(c.uid)}
                  disabled={disabled}
                />
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-gray-200 text-black font-semibold text-xs">
                    {name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[15px] text-black truncate">{name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
