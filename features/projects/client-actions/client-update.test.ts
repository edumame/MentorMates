import { updateProjectTeamClient } from "./client-update";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

// teammates is not client-readable, so both the fresh read and the returned
// project's team come from the project_team_emails RPC.
function mockProject(
  storedTeammates: string[] | null,
  { readError = null, missing = false }: { readError?: unknown; missing?: boolean } = {}
) {
  let teammates = storedTeammates;
  (supabase.rpc as jest.Mock).mockImplementation(async (fn: string) => {
    expect(fn).toBe("project_team_emails");
    if (readError) return { data: null, error: readError };
    if (missing) return { data: [], error: null };
    return {
      data: [{ project_id: "p1", lead_email: "lead@x.com", teammates }],
      error: null,
    };
  });
  const update = jest.fn((values: { teammates: string[] }) => ({
    eq: () => ({
      select: () => ({
        single: async () => {
          teammates = values.teammates;
          return { data: { id: "p1" }, error: null };
        },
      }),
    }),
  }));
  (supabase.from as jest.Mock).mockReturnValue({ update });
  return update;
}

describe("updateProjectTeamClient", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps a teammate who joined after the page loaded when adding", async () => {
    const update = mockProject(["a@x.com", "joined@x.com"]);

    const { data } = await updateProjectTeamClient("p1", { add: ["c@x.com"] });

    expect(update).toHaveBeenCalledWith({
      teammates: ["a@x.com", "joined@x.com", "c@x.com"],
    });
    expect(data?.teammates).toEqual(["a@x.com", "joined@x.com", "c@x.com"]);
    expect(data?.lead_email).toBe("lead@x.com");
  });

  it("keeps a teammate who joined after the page loaded when removing", async () => {
    const update = mockProject(["a@x.com", "joined@x.com"]);

    await updateProjectTeamClient("p1", { remove: ["a@x.com"] });

    expect(update).toHaveBeenCalledWith({ teammates: ["joined@x.com"] });
  });

  it("treats a null stored list as empty", async () => {
    const update = mockProject(null);

    await updateProjectTeamClient("p1", { add: ["c@x.com"] });

    expect(update).toHaveBeenCalledWith({ teammates: ["c@x.com"] });
  });

  it("does not write when the current team cannot be read", async () => {
    const readError = { message: "denied" };
    const update = mockProject(null, { readError });

    const result = await updateProjectTeamClient("p1", { add: ["c@x.com"] });

    expect(result).toEqual({ data: null, error: readError });
    expect(update).not.toHaveBeenCalled();
  });

  it("does not write an empty team when the project is not returned", async () => {
    const update = mockProject(["a@x.com"], { missing: true });

    const result = await updateProjectTeamClient("p1", { remove: ["a@x.com"] });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Project team not found");
    expect(update).not.toHaveBeenCalled();
  });
});
