import { fetchUserProjectIds } from "./user-project-ids";

type Client = Parameters<typeof fetchUserProjectIds>[0];

function mockClient(result: { data: { id: string }[] | null; error: unknown }) {
  const or = jest.fn().mockResolvedValue(result);
  const client = {
    from: jest.fn(() => ({ select: jest.fn(() => ({ or })) })),
  } as unknown as Client;
  return { client, or };
}

describe("fetchUserProjectIds", () => {
  it("matches projects by lead email or teammate email", async () => {
    const { client, or } = mockClient({
      data: [{ id: "project-1" }],
      error: null,
    });

    await expect(fetchUserProjectIds(client, "a@example.com")).resolves.toEqual({
      projectIds: ["project-1"],
      error: null,
    });
    expect(or).toHaveBeenCalledWith(
      'lead_email.eq.a@example.com,teammates.cs.{"a@example.com"}',
    );
  });

  it("returns the query error to the caller", async () => {
    const error = { code: "57014" };
    const { client } = mockClient({ data: null, error });

    await expect(fetchUserProjectIds(client, "a@example.com")).resolves.toEqual({
      projectIds: [],
      error,
    });
  });

  it.each([undefined, null, ""])(
    "skips the query when the email is %p",
    async (email) => {
      const { client, or } = mockClient({ data: [], error: null });

      await expect(fetchUserProjectIds(client, email)).resolves.toEqual({
        projectIds: [],
        error: null,
      });
      expect(or).not.toHaveBeenCalled();
    },
  );
});
