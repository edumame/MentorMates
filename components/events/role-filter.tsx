"use client";

import { EventRole } from "@/lib/types";

/**
 * Shared role-filter primitives used by both the public participants page
 * (`ParticipantsContent`) and the organizer "People" subtab (`ParticipantsTab`).
 * Keep these in one place so the two surfaces can't drift on order, labels,
 * or chip styling. See CLAUDE.md "Project Detail Route Parity" rationale.
 */

export type RoleFilter = EventRole | "all";

export const ROLE_FILTER_ORDER: RoleFilter[] = [
  "all",
  EventRole.Organizer,
  EventRole.Participant,
  EventRole.Mentor,
  EventRole.Judge,
  EventRole.Admin,
];

export function defaultRoleLabel(role: RoleFilter): string {
  if (role === "all") return "All";
  const map: Record<EventRole, string> = {
    [EventRole.Participant]: "Participant",
    [EventRole.Mentor]: "Mentor",
    [EventRole.Judge]: "Judge",
    [EventRole.Organizer]: "Organizer",
    [EventRole.Admin]: "Admin",
  };
  return map[role];
}

/** Honor event-specific custom role labels, falling back to the defaults. */
export function resolveRoleLabel(
  role: RoleFilter,
  eventRoleLabels?: Record<string, string> | null
): string {
  if (role === "all") return defaultRoleLabel("all");
  return eventRoleLabels?.[role] || defaultRoleLabel(role);
}

/** Count rows per role plus an "all" total. Accepts anything carrying a role. */
export function computeRoleCounts(
  rows: { role: EventRole }[]
): Record<string, number> {
  const counts: Record<string, number> = { all: rows.length };
  for (const row of rows) counts[row.role] = (counts[row.role] || 0) + 1;
  return counts;
}

interface RoleFilterChipsProps {
  counts: Record<string, number>;
  activeFilter: RoleFilter;
  onFilterChange: (role: RoleFilter) => void;
  eventRoleLabels?: Record<string, string> | null;
}

/**
 * Renders the Organizer / Participant / Mentor / Judge / Admin chip row with
 * per-role counts. Zero-count roles are hidden (except "All").
 */
export function RoleFilterChips({
  counts,
  activeFilter,
  onFilterChange,
  eventRoleLabels,
}: RoleFilterChipsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by role"
      className="flex flex-wrap gap-2 py-3 border-b border-[rgba(0,0,0,0.08)] mb-2"
    >
      {ROLE_FILTER_ORDER.filter(
        (r) => r === "all" || (counts[r] ?? 0) > 0
      ).map((role) => {
        const isActive = activeFilter === role;
        return (
          <button
            key={role}
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(role)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "bg-[#4b89ef] text-white"
                : "bg-[#f2f2f2] text-black hover:bg-[#e5e5e5]"
            }`}
          >
            {resolveRoleLabel(role, eventRoleLabels)}{" "}
            <span
              className={`ml-1 text-xs font-normal ${
                isActive ? "text-white/80" : "text-gray-600"
              }`}
            >
              {counts[role] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
