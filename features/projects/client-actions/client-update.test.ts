import { updateProjectTeamClient } from "./client-update";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

function mockProjectsTable(storedTeammates: string[] | null, readError: unknown = null) {
  const readSingle = jest
    .fn()
    .mockResolvedValue({
      data: readError ? null : { teammates: storedTeammates },
      error: readError,
    });
  const update = jest.fn((values: { teammates: string[] }) => ({
    eq: () => ({
      select: () => ({
        single: async () => ({ data: { id: "p1", ...values }, error: null }),
      }),
    }),
  }));
  (supabase.from as jest.Mock).mockReturnValue({
    select: () => ({ eq: () => ({ single: readSingle }) }),
    update,
  });
  return update;
}

describe("updateProjectTeamClient", () => {
  it("keeps a teammate who joined after the page loaded when adding", async () => {
    const update = mockProjectsTable(["a@x.com", "joined@x.com"]);

    const { data } = await updateProjectTeamClient("p1", { add: ["c@x.com"] });

    expect(update).toHaveBeenCalledWith({
      teammates: ["a@x.com", "joined@x.com", "c@x.com"],
    });
    expect(data?.teammates).toEqual(["a@x.com", "joined@x.com", "c@x.com"]);
  });

  it("keeps a teammate who joined after the page loaded when removing", async () => {
    const update = mockProjectsTable(["a@x.com", "joined@x.com"]);

    await updateProjectTeamClient("p1", { remove: ["a@x.com"] });

    expect(update).toHaveBeenCalledWith({ teammates: ["joined@x.com"] });
  });

  it("does not write when the current team cannot be read", async () => {
    const readError = { message: "denied" };
    const update = mockProjectsTable(null, readError);

    const result = await updateProjectTeamClient("p1", { add: ["c@x.com"] });

    expect(result).toEqual({ data: null, error: readError });
    expect(update).not.toHaveBeenCalled();
  });
});
