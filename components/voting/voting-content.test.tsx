import { render, screen, waitFor, within } from "@testing-library/react";
import { VotingContent } from "./voting-content";
import { OWN_PROJECT_VOTE_BLOCK_MESSAGE } from "@/features/voting/utils/voting-permissions";

jest.mock("framer-motion", () => ({
  motion: { div: ({ children, ...rest }: { children: React.ReactNode }) => <div {...(rest as object)}>{children}</div> },
}));

jest.mock("@/features/projects/components/displays/cover-image-with-fallback", () => ({
  CoverImageWithFallback: () => null,
}));

const hookState = {
  remainingVotes: 3,
  maxVotes: 3,
  canVote: true,
  blockedReason: null as string | null,
  votingStatus: "open" as const,
  votingClosesAt: null as string | null,
  isLoading: false,
  error: null as string | null,
  hasVoted: (id: string): boolean => id === "voted",
  isOwnProject: (id: string): boolean => id === "mine",
  toggleVote: jest.fn(),
  // Even if totals leaked to the client, ordering must not use them.
  getVoteCount: (id: string) => (id === "zulu" ? 99 : 0),
};

jest.mock("@/features/voting/hooks/use-event-votes", () => ({
  useEventVotes: () => hookState,
}));

const projects = [
  { id: "zulu", project_name: "Zulu", lead_name: "Z" },
  { id: "mine", project_name: "Mine", lead_name: "Me" },
  { id: "alpha", project_name: "Alpha", lead_name: "A" },
  { id: "voted", project_name: "Voted", lead_name: "V" },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ projects }),
  }) as unknown as typeof fetch;
});

// Card titles (the thumbnail fallback repeats the name in a second h3).
const titleElements = () => Array.from(document.querySelectorAll<HTMLElement>("h3.font-bold"));

async function renderCards() {
  render(<VotingContent eventId="event" hasJoined />);
  await waitFor(() => expect(titleElements().length).toBe(projects.length));
  return titleElements().map((h) => h.textContent);
}

const cardFor = (name: string) =>
  titleElements().find((h) => h.textContent === name)!.closest("div.py-4") as HTMLElement;

it("orders by the viewer's ballot then name, never by vote totals", async () => {
  expect(await renderCards()).toEqual(["Voted", "Alpha", "Mine", "Zulu"]);
});

it("disables voting on the viewer's own project with a reason", async () => {
  await renderCards();
  const ownCard = cardFor("Mine");
  expect(within(ownCard).getByRole("button", { name: /vote/i })).toBeDisabled();
  expect(within(ownCard).getByText(OWN_PROJECT_VOTE_BLOCK_MESSAGE)).toBeInTheDocument();

  const otherCard = cardFor("Alpha");
  expect(within(otherCard).getByRole("button", { name: /vote/i })).toBeEnabled();
});

it("tells voters totals are organizer-only", async () => {
  await renderCards();
  expect(screen.getByText("Vote totals are only visible to organizers.")).toBeInTheDocument();
});

it("shows the closed-window reason and disables every vote button", async () => {
  hookState.canVote = false;
  hookState.blockedReason = "Voting has closed.";
  try {
    await renderCards();
    expect(screen.getByText("Voting has closed.")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /vote/i })) {
      if (button.textContent?.includes("Voted")) continue;
      expect(button).toBeDisabled();
    }
    expect(screen.queryByText(OWN_PROJECT_VOTE_BLOCK_MESSAGE)).not.toBeInTheDocument();
  } finally {
    hookState.canVote = true;
    hookState.blockedReason = null;
  }
});

it("still lets a voter withdraw an existing vote on their own project", async () => {
  const original = hookState.isOwnProject;
  hookState.isOwnProject = (id: string): boolean => id === "voted";
  try {
    await renderCards();
    const card = cardFor("Voted");
    expect(within(card).getByRole("button", { name: /voted/i })).toBeEnabled();
    expect(within(card).queryByText(OWN_PROJECT_VOTE_BLOCK_MESSAGE)).not.toBeInTheDocument();
  } finally {
    hookState.isOwnProject = original;
  }
});
