import {
  fetchArtifactsByProjectIds,
  fetchSubmissionAnswersByProjectIds,
} from "@/lib/projects/query";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";
import {
  buildAnswerRows,
  createFakePostgrestClient,
  FakeTable,
} from "@/lib/projects/query.test-helpers";

const PROJECT_COUNT = 120;
const ANSWERS_PER_PROJECT = 9;
const PROJECT_IDS = Array.from(
  { length: PROJECT_COUNT },
  (_, index) => `project-${index}`,
);

function clientFor(
  tables: Record<string, FakeTable>,
  options?: { maxRows?: number },
) {
  const client = createFakePostgrestClient(tables, options);
  return {
    client,
    supabase: client as unknown as ServiceSupabaseClient,
  };
}

function buildArtifactRows(projectCount: number, artifactsPerProject: number) {
  return Array.from({ length: projectCount * artifactsPerProject }, (_, index) => ({
    id: `artifact-${index}`,
    project_id: `project-${index % projectCount}`,
    kind: "additional_material",
    label: "Material",
    url: `https://example.com/${index}`,
    sort_order: Math.floor(index / projectCount),
    is_primary: false,
    metadata: null,
  }));
}

describe("fetchSubmissionAnswersByProjectIds", () => {
  it.each([
    ["the default 1000-row cap", 1000],
    ["a cap lower than the page size", 400],
  ])("returns every answer past %s", async (_label, maxRows) => {
    const { supabase } = clientFor(
      {
        project_submission_answers: {
          rows: buildAnswerRows(PROJECT_COUNT, ANSWERS_PER_PROJECT),
        },
      },
      { maxRows },
    );

    const answers = await fetchSubmissionAnswersByProjectIds(
      supabase,
      PROJECT_IDS,
    );

    expect(answers.size).toBe(PROJECT_COUNT);
    for (const projectId of PROJECT_IDS) {
      expect(answers.get(projectId)).toHaveLength(ANSWERS_PER_PROJECT);
    }
  });

  it("returns exactly one page's worth of rows without a duplicate read", async () => {
    const { client, supabase } = clientFor({
      project_submission_answers: { rows: buildAnswerRows(100, 10) },
    });

    const answers = await fetchSubmissionAnswersByProjectIds(
      supabase,
      PROJECT_IDS.slice(0, 100),
    );

    expect([...answers.values()].flat()).toHaveLength(1000);
    expect(client.requests).toHaveLength(1);
  });

  it("uses a stable order so pages cannot overlap or skip rows", async () => {
    const { client, supabase } = clientFor({
      project_submission_answers: {
        rows: buildAnswerRows(PROJECT_COUNT, ANSWERS_PER_PROJECT),
      },
    });

    await fetchSubmissionAnswersByProjectIds(supabase, PROJECT_IDS);

    expect(client.requests.length).toBeGreaterThan(1);
    for (const request of client.requests) {
      expect(request.order).toEqual(["id"]);
    }
  });

  it("returns an empty map without querying when there are no ids", async () => {
    const { client, supabase } = clientFor({});

    const answers = await fetchSubmissionAnswersByProjectIds(supabase, []);

    expect(answers.size).toBe(0);
    expect(client.requests).toHaveLength(0);
  });

  it("returns an empty map when the projects have no answers", async () => {
    const { client, supabase } = clientFor({
      project_submission_answers: { rows: [] },
    });

    const answers = await fetchSubmissionAnswersByProjectIds(supabase, [
      "project-0",
    ]);

    expect(answers.size).toBe(0);
    expect(client.requests).toHaveLength(1);
  });

  it("rejects when the read fails instead of reporting no answers", async () => {
    const error = { message: "connection reset" };
    const { supabase } = clientFor({
      project_submission_answers: { error },
    });

    await expect(
      fetchSubmissionAnswersByProjectIds(supabase, ["project-0"]),
    ).rejects.toBe(error);
  });
});

describe("fetchArtifactsByProjectIds", () => {
  it("returns every artifact past the row cap, in sort order per project", async () => {
    const { client, supabase } = clientFor({
      project_artifacts: { rows: buildArtifactRows(PROJECT_COUNT, 9) },
    });

    const artifacts = await fetchArtifactsByProjectIds(supabase, PROJECT_IDS);

    for (const projectId of PROJECT_IDS) {
      expect(
        artifacts.get(projectId)?.map((artifact) => artifact.sort_order),
      ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
    for (const request of client.requests) {
      expect(request.order).toEqual(["sort_order", "id"]);
    }
  });

  it("rejects when the read fails instead of reporting no artifacts", async () => {
    const error = { message: "connection reset" };
    const { supabase } = clientFor({ project_artifacts: { error } });

    await expect(
      fetchArtifactsByProjectIds(supabase, ["project-0"]),
    ).rejects.toBe(error);
  });
});
