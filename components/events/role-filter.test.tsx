import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RoleFilterChips,
  computeRoleCounts,
  resolveRoleLabel,
} from "./role-filter";
import { EventRole } from "@/lib/types";

const rows = [
  { role: EventRole.Organizer },
  { role: EventRole.Participant },
  { role: EventRole.Participant },
  { role: EventRole.Mentor },
];

describe("computeRoleCounts", () => {
  it("counts per role plus an 'all' total", () => {
    const counts = computeRoleCounts(rows);
    expect(counts.all).toBe(4);
    expect(counts[EventRole.Organizer]).toBe(1);
    expect(counts[EventRole.Participant]).toBe(2);
    expect(counts[EventRole.Mentor]).toBe(1);
  });

  it("returns all=0 for an empty list", () => {
    expect(computeRoleCounts([])).toEqual({ all: 0 });
  });
});

describe("resolveRoleLabel", () => {
  it("returns 'All' for the all filter", () => {
    expect(resolveRoleLabel("all")).toBe("All");
  });

  it("falls back to the default label when no custom labels", () => {
    expect(resolveRoleLabel(EventRole.Mentor)).toBe("Mentor");
  });

  it("prefers a custom event role label when provided", () => {
    expect(
      resolveRoleLabel(EventRole.Mentor, { [EventRole.Mentor]: "Coach" })
    ).toBe("Coach");
  });

  it("ignores an empty-string custom label and uses the default", () => {
    expect(resolveRoleLabel(EventRole.Judge, { [EventRole.Judge]: "" })).toBe(
      "Judge"
    );
  });
});

describe("RoleFilterChips", () => {
  const counts = computeRoleCounts(rows);

  it("renders 'All' plus only roles with a non-zero count", () => {
    render(
      <RoleFilterChips
        counts={counts}
        activeFilter="all"
        onFilterChange={() => {}}
      />
    );
    expect(screen.getByRole("tab", { name: /^all/i })).toHaveTextContent("4");
    expect(screen.getByRole("tab", { name: /^organizer/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^participant/i })).toHaveTextContent(
      "2"
    );
    // Judge and Admin have zero count → hidden
    expect(
      screen.queryByRole("tab", { name: /^judge/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^admin/i })
    ).not.toBeInTheDocument();
  });

  it("marks the active chip with aria-selected", () => {
    render(
      <RoleFilterChips
        counts={counts}
        activeFilter={EventRole.Participant}
        onFilterChange={() => {}}
      />
    );
    expect(
      screen.getByRole("tab", { name: /^participant/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^all/i })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("invokes onFilterChange with the chosen role", async () => {
    const onFilterChange = jest.fn();
    render(
      <RoleFilterChips
        counts={counts}
        activeFilter="all"
        onFilterChange={onFilterChange}
      />
    );
    await userEvent.click(screen.getByRole("tab", { name: /^organizer/i }));
    expect(onFilterChange).toHaveBeenCalledWith(EventRole.Organizer);
  });

  it("renders custom role labels on the chips", () => {
    render(
      <RoleFilterChips
        counts={counts}
        activeFilter="all"
        onFilterChange={() => {}}
        eventRoleLabels={{ [EventRole.Participant]: "Founder" }}
      />
    );
    expect(screen.getByRole("tab", { name: /founder/i })).toBeInTheDocument();
  });
});
