import { act, renderHook, waitFor } from "@testing-library/react";

import { useEventVotes } from "./use-event-votes";

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

function votesPayload(overrides: Record<string, unknown> = {}) {
  return {
    voteCounts: {},
    userVotes: [],
    remainingVotes: 1,
    maxVotes: 3,
    canVote: true,
    blockedReason: null,
    ...overrides,
  };
}

function mockFetch(
  getPayloads: Record<string, unknown>[],
  postResponses: ReturnType<typeof jsonResponse>[]
) {
  const gets = [...getPayloads];
  const posts = [...postResponses];
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return posts.shift();
    }
    return jsonResponse(gets.length > 1 ? gets.shift() : gets[0]);
  }) as unknown as typeof fetch;
}

function getCallCount() {
  return (fetch as jest.Mock).mock.calls.filter(
    ([, init]) => init?.method !== "POST"
  ).length;
}

async function renderLoadedHook() {
  const rendered = renderHook(() => useEventVotes("event-1"));
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return rendered;
}

describe("useEventVotes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("never reports a negative remaining vote count", async () => {
    mockFetch(
      [votesPayload()],
      [jsonResponse({ success: true }), jsonResponse({ success: true })]
    );
    const { result } = await renderLoadedHook();

    const { vote } = result.current;
    await act(async () => {
      await Promise.all([vote("a"), vote("b")]);
    });

    expect(result.current.remainingVotes).toBe(0);
  });

  it("uses the remaining count returned by the server after a vote", async () => {
    mockFetch(
      [votesPayload({ remainingVotes: 3 })],
      // Another tab already used a vote: the server says 1 left, not 2.
      [jsonResponse({ success: true, remainingVotes: 1 })]
    );
    const { result } = await renderLoadedHook();

    await act(async () => {
      await result.current.vote("a");
    });

    expect(result.current.remainingVotes).toBe(1);
  });

  it("resyncs with the server and keeps the message when a concurrent vote is rejected", async () => {
    const capMessage = "You can only vote for 3 projects per event";
    mockFetch(
      [
        votesPayload(),
        votesPayload({
          userVotes: ["a"],
          voteCounts: { a: 1 },
          remainingVotes: 0,
        }),
      ],
      [jsonResponse({ success: true }), jsonResponse({ error: capMessage }, 400)]
    );
    const { result } = await renderLoadedHook();

    const { vote } = result.current;
    let outcomes: boolean[] = [];
    await act(async () => {
      outcomes = await Promise.all([vote("a"), vote("b")]);
    });

    expect(outcomes).toEqual([true, false]);
    expect(getCallCount()).toBe(2);
    expect(result.current.remainingVotes).toBe(0);
    expect(result.current.hasVoted("b")).toBe(false);
    expect(result.current.error).toBe(capMessage);
  });

  it("resyncs eligibility when the server refuses the voter's role", async () => {
    const blocked = "Only event members who are not judges can vote";
    mockFetch(
      [
        votesPayload(),
        votesPayload({
          remainingVotes: 0,
          canVote: false,
          blockedReason: blocked,
        }),
      ],
      [jsonResponse({ error: blocked }, 403)]
    );
    const { result } = await renderLoadedHook();

    await act(async () => {
      await result.current.vote("a");
    });

    expect(result.current.canVote).toBe(false);
    expect(result.current.error).toBe(blocked);
  });
});
