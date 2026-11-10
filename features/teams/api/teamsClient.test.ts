import { deleteTeamOrMember } from "./teamsClient";

function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("deleteTeamOrMember", () => {
  it("reports when the server dissolved the team", async () => {
    const fetchMock = mockFetch(200, { success: true, dissolved: true });

    await expect(deleteTeamOrMember("e1", "t1", "lead")).resolves.toEqual({
      dissolved: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/e1/teams?teamId=t1&userId=lead",
      { method: "DELETE" }
    );
  });

  it("reports a plain member removal as not dissolved", async () => {
    mockFetch(200, { success: true });

    await expect(deleteTeamOrMember("e1", "t1", "member")).resolves.toEqual({
      dissolved: false,
    });
  });

  it("throws the server error on failure", async () => {
    mockFetch(403, { error: "Forbidden" });

    await expect(deleteTeamOrMember("e1", "t1", "member")).rejects.toThrow(
      "Forbidden"
    );
  });
});
