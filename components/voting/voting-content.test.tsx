import { render, screen, waitFor } from "@testing-library/react";
import { VotingContent } from "./voting-content";

jest.mock("@/features/voting/hooks/use-event-votes", () => ({
  useEventVotes: () => ({
    remainingVotes: 3,
    maxVotes: 3,
    canVote: true,
    blockedReason: null,
    isLoading: false,
    error: null,
    hasVoted: () => false,
    getVoteCount: () => 0,
    toggleVote: jest.fn(),
  }),
}));

const EVENT_ID = "event-1";
const EMPTY_STATE = "No projects to vote on yet";

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

// Mirrors GET /api/projects: public=true is gated on visibility === "public",
// and the listing without it requires a signed-in user.
function mockProjectsApi({
  publicListing,
  memberListing,
}: {
  publicListing: ReturnType<typeof jsonResponse>;
  memberListing: ReturnType<typeof jsonResponse>;
}) {
  const fetchMock = jest.fn(async (url: string) =>
    url.includes("public=true") ? publicListing : memberListing
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const notFound = jsonResponse(404, { error: "Event not found" });
const projectList = jsonResponse(200, {
  projects: [{ id: "p1", project_name: "Alpha" }],
});

describe("VotingContent project loading", () => {
  const originalFetch = global.fetch;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    global.fetch = originalFetch;
  });

  it("shows submitted projects to members of a non-public event", async () => {
    const fetchMock = mockProjectsApi({
      publicListing: notFound,
      memberListing: projectList,
    });

    render(<VotingContent eventId={EVENT_ID} hasJoined />);

    // The card repeats the name over its placeholder cover image.
    expect(
      (await screen.findAllByRole("heading", { name: "Alpha" })).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(EMPTY_STATE)).not.toBeInTheDocument();
    // Organizers also see drafts in this listing unless submitted=true is set.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects?eventId=${EVENT_ID}&submitted=true`
    );
  });

  it("keeps the public listing for visitors who have not joined", async () => {
    const fetchMock = mockProjectsApi({
      publicListing: projectList,
      memberListing: jsonResponse(401, { error: "Unauthorized" }),
    });

    render(<VotingContent eventId={EVENT_ID} hasJoined={false} />);

    // The card repeats the name over its placeholder cover image.
    expect(
      (await screen.findAllByRole("heading", { name: "Alpha" })).length
    ).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects?eventId=${EVENT_ID}&public=true`
    );
  });

  it("shows an error, not the empty state, when a member's listing fails", async () => {
    const failure = jsonResponse(500, { error: "Failed to fetch projects" });
    mockProjectsApi({ publicListing: failure, memberListing: failure });

    render(<VotingContent eventId={EVENT_ID} hasJoined />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn.t load projects/i
    );
    expect(screen.queryByText(EMPTY_STATE)).not.toBeInTheDocument();
  });

  it("shows an error, not the empty state, when a visitor cannot see a non-public event", async () => {
    mockProjectsApi({
      publicListing: notFound,
      memberListing: jsonResponse(401, { error: "Unauthorized" }),
    });

    render(<VotingContent eventId={EVENT_ID} hasJoined={false} />);

    expect(await screen.findByText(/private or unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_STATE)).not.toBeInTheDocument();
  });

  it("shows an error when the request itself rejects", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    render(<VotingContent eventId={EVENT_ID} hasJoined />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn.t load projects/i
    );
    expect(screen.queryByText(EMPTY_STATE)).not.toBeInTheDocument();
  });

  it("keeps the empty state for a successful listing with no projects", async () => {
    const empty = jsonResponse(200, { projects: [] });
    mockProjectsApi({ publicListing: empty, memberListing: empty });

    render(<VotingContent eventId={EVENT_ID} hasJoined />);

    await waitFor(() =>
      expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument()
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
