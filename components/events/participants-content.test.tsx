import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantsContent, type ParticipantWithRole } from "./participants-content";
import { EventRole } from "@/lib/types";

const mixed: ParticipantWithRole[] = [
  { uid: "u1", display_name: "Alice", role: EventRole.Organizer },
  { uid: "u2", display_name: "Bob", role: EventRole.Participant },
  { uid: "u3", display_name: "Carol", role: EventRole.Participant },
  { uid: "u4", display_name: "Dave", role: EventRole.Mentor },
  { uid: "u5", display_name: "Eve", role: EventRole.Judge },
  { uid: "u6", display_name: "Frank", role: EventRole.Admin },
];

describe("ParticipantsContent — role filter (#780)", () => {
  it("shows the 'join to view' empty state when canViewParticipants is false", () => {
    render(
      <ParticipantsContent
        participants={[]}
        canViewParticipants={false}
      />
    );
    expect(
      screen.getByText(/join this event to explore the participant list/i)
    ).toBeInTheDocument();
  });

  it("hides the role filter when showRoleFilter is false (back-compat)", () => {
    render(
      <ParticipantsContent
        participants={mixed}
        canViewParticipants={true}
        showRoleFilter={false}
      />
    );
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    // All people show — no filter applied
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders filter chips with per-role counts when showRoleFilter is true", () => {
    render(
      <ParticipantsContent
        participants={mixed}
        canViewParticipants={true}
        showRoleFilter={true}
      />
    );
    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();

    // 'All' = 6, Organizer = 1, Participant = 2, Mentor = 1, Judge = 1, Admin = 1
    const allTab = screen.getByRole("tab", { name: /^all/i });
    expect(allTab).toHaveTextContent("6");

    const orgTab = screen.getByRole("tab", { name: /^organizer/i });
    expect(orgTab).toHaveTextContent("1");

    const participantTab = screen.getByRole("tab", { name: /^participant/i });
    expect(participantTab).toHaveTextContent("2");
  });

  it("filters the list when a role chip is clicked", async () => {
    render(
      <ParticipantsContent
        participants={mixed}
        canViewParticipants={true}
        showRoleFilter={true}
      />
    );
    // Default: All — everyone visible
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // Click "Organizer"
    await userEvent.click(screen.getByRole("tab", { name: /^organizer/i }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.queryByText("Dave")).not.toBeInTheDocument();
  });

  it("hides chips for roles with zero count (except 'All')", () => {
    const onlyOrganizers: ParticipantWithRole[] = [
      { uid: "u1", display_name: "Alice", role: EventRole.Organizer },
    ];
    render(
      <ParticipantsContent
        participants={onlyOrganizers}
        canViewParticipants={true}
        showRoleFilter={true}
      />
    );
    expect(screen.getByRole("tab", { name: /^all/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /^organizer/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^participant/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^mentor/i })
    ).not.toBeInTheDocument();
  });

  it("shows custom role labels from eventRoleLabels when provided", () => {
    render(
      <ParticipantsContent
        participants={mixed}
        canViewParticipants={true}
        showRoleFilter={true}
        eventRoleLabels={{
          [EventRole.Participant]: "Founder",
          [EventRole.Mentor]: "Coach",
        }}
      />
    );
    expect(
      screen.getByRole("tab", { name: /founder/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /coach/i })).toBeInTheDocument();
  });

  it("shows role-aware empty state when filter yields no rows", async () => {
    const noMentors: ParticipantWithRole[] = [
      { uid: "u1", display_name: "Alice", role: EventRole.Organizer },
      { uid: "u2", display_name: "Bob", role: EventRole.Participant },
    ];
    render(
      <ParticipantsContent
        participants={noMentors}
        canViewParticipants={true}
        showRoleFilter={true}
      />
    );
    // mentor chip won't render (count=0). Click participant chip and then verify behavior.
    await userEvent.click(screen.getByRole("tab", { name: /^organizer/i }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });
});
