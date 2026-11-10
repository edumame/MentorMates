import { getTeamEmails, getUserProjectIds } from "./membership";

const client = (result: { data: unknown; error: unknown }) => {
  const rpc = jest.fn(async () => result);
  return { rpc, client: { rpc } as never };
};

describe("getUserProjectIds", () => {
  it("uses the my_project_ids function and dedupes", async () => {
    const { rpc, client: c } = client({ data: ["p1", "p1", "p2"], error: null });
    expect(await getUserProjectIds(c)).toEqual({ ids: ["p1", "p2"], error: null });
    expect(rpc).toHaveBeenCalledWith("my_project_ids", {});
  });
  it("scopes to an event", async () => {
    const { rpc, client: c } = client({ data: [], error: null });
    await getUserProjectIds(c, "e1");
    expect(rpc).toHaveBeenCalledWith("my_project_ids", { p_event_id: "e1" });
  });
  it("surfaces errors instead of an empty list", async () => {
    const { client: c } = client({ data: null, error: { message: "x" } });
    expect(await getUserProjectIds(c)).toMatchObject({ ids: null });
  });
});

describe("getTeamEmails", () => {
  it("maps rows the caller may see; nothing else", async () => {
    const { client: c } = client({ data: [{ project_id: "p1", lead_email: "l@x.test", teammates: null }], error: null });
    const map = await getTeamEmails(c, ["p1", "p2"]);
    expect(map.get("p1")).toEqual({ lead_email: "l@x.test", teammates: [] });
    expect(map.has("p2")).toBe(false);
  });
  it("returns an empty map on error", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { client: c } = client({ data: null, error: { message: "x" } });
    expect((await getTeamEmails(c, ["p1"])).size).toBe(0);
    spy.mockRestore();
  });
});
