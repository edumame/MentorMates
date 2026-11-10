/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/integrations/contextus", () => ({
  createContextusProject: jest.fn(),
}));

const projectId = "22222222-2222-4222-8222-222222222222";
const currentEventId = "11111111-1111-4111-8111-111111111111";
const previousEventId = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;

// Applies eq() filters so a query that forgets to scope by event sees the row.
const query = (rows: Row[]) => {
  const filters: Array<[string, unknown]> = [];
  const result = () => ({
    data: rows.filter((row) =>
      filters.every(([column, value]) => row[column] === undefined || row[column] === value),
    ),
    error: null,
  });
  const single = () => {
    const { data, error } = result();
    return { data: data[0] ?? null, error };
  };
  const builder: Record<string, unknown> = {
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result()).then(resolve, reject),
    overrideTypes: jest.fn(() => Promise.resolve(result())),
    eq: jest.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    }),
    maybeSingle: jest.fn(() => ({
      overrideTypes: jest.fn(() => Promise.resolve(single())),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(single()).then(resolve, reject),
    })),
  };
  for (const method of ["select", "in", "order", "limit"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  return builder;
};

describe("GET /api/projects finalist status", () => {
  const getProject = async (advancements: Row[]) => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "projects") {
          return query([
            {
              id: projectId,
              project_name: "Moved Project",
              event_id: currentEventId,
              submitted: true,
              project_tracks: [],
            },
          ]);
        }
        if (table === "events") return query([{ visibility: "public" }]);
        return query([]);
      }),
    });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query(advancements)),
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/projects?public=true&projectId=${projectId}`,
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      project: { is_finalist?: boolean };
    };
    return payload.project;
  };

  it("is true for an advancement in the project's current event", async () => {
    const project = await getProject([
      { id: "adv-1", project_id: projectId, event_id: currentEventId },
    ]);

    expect(project.is_finalist).toBe(true);
  });

  it("ignores an advancement left over from a previous event", async () => {
    const project = await getProject([
      { id: "adv-1", project_id: projectId, event_id: previousEventId },
    ]);

    expect(project.is_finalist).toBe(false);
  });
});
