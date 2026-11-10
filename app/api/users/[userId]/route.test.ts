/** @jest-environment node */
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const uid = "11111111-1111-4111-8111-111111111111";
const update = jest.fn();

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const op of ["select", "eq", "order", "limit", "single"]) {
    query[op] = () => query;
  }
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: uid } }, error: null }),
    },
    from: (table: string) => {
      if (table === "user_phone_numbers") return chain({ data: [], error: null });
      return {
        ...chain({ data: { uid }, error: null }),
        update: (values: unknown) => {
          update(values);
          return chain({ data: { uid, ...(values as object) }, error: null });
        },
      };
    },
  } as never);
});

const patch = (body: unknown) =>
  PATCH(
    new NextRequest(`https://example.test/api/users/${uid}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ userId: uid }) }
  );

describe("PATCH /api/users/[userId] affiliation", () => {
  it("clears the column when the client sends an explicit null", async () => {
    const response = await patch({ affiliation: null, bio: null, links: {} });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toHaveProperty("affiliation", null);
  });

  it("clears the column when affiliation is the only field sent", async () => {
    const response = await patch({ affiliation: null });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ affiliation: null });
  });

  it("saves a new affiliation", async () => {
    await patch({ affiliation: "Acme" });

    expect(update).toHaveBeenCalledWith({ affiliation: "Acme" });
  });

  it("maps the legacy school field to affiliation", async () => {
    await patch({ school: "State U" });

    expect(update).toHaveBeenCalledWith({ affiliation: "State U" });
  });

  it("lets a legacy client clear the column with school: null", async () => {
    await patch({ school: null });

    expect(update).toHaveBeenCalledWith({ affiliation: null });
  });

  it("prefers affiliation over school when both are sent", async () => {
    await patch({ affiliation: "Acme", school: "State U" });

    expect(update).toHaveBeenCalledWith({ affiliation: "Acme" });
  });

  it("treats an explicit null affiliation as a clear even if school is sent", async () => {
    await patch({ affiliation: null, school: "State U" });

    expect(update).toHaveBeenCalledWith({ affiliation: null });
  });

  it("leaves the column alone when neither field is sent", async () => {
    await patch({ bio: "Hello" });

    expect(update).toHaveBeenCalledWith({ bio: "Hello" });
    expect(update.mock.calls[0][0]).not.toHaveProperty("affiliation");
  });
});
