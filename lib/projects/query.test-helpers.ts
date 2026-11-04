type Row = Record<string, unknown>;

export type FakeTable = { rows?: Row[]; error?: unknown };

export type FakeRequest = {
  table: string;
  order: string[];
  range?: [number, number];
};

/**
 * Minimal Supabase client that behaves like PostgREST for reads: every response
 * is silently capped at `maxRows` with `error: null`, and `.range()` selects
 * the window the cap applies to.
 */
export function createFakePostgrestClient(
  tables: Record<string, FakeTable>,
  { maxRows = 1000 }: { maxRows?: number } = {},
) {
  const requests: FakeRequest[] = [];

  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const request: FakeRequest = { table, order: [] };
    let wantsCount = false;

    const execute = () => {
      requests.push(request);
      const { rows = [], error = null } = tables[table] ?? {};
      if (error) return { data: null, error, count: null };

      const matching = rows.filter((row) => filters.every((f) => f(row)));
      for (const column of [...request.order].reverse()) {
        matching.sort((a, b) =>
          String(a[column]).localeCompare(String(b[column]), undefined, {
            numeric: true,
          }),
        );
      }
      const [start, end] = request.range ?? [0, matching.length - 1];
      return {
        data: matching.slice(start, end + 1).slice(0, maxRows),
        error: null,
        count: wantsCount ? matching.length : null,
      };
    };

    const first = () => {
      const { data, error } = execute();
      return { data: data?.[0] ?? null, error };
    };

    const builder = {
      select: (_columns?: string, options?: { count?: string }) => {
        wantsCount = options?.count === "exact";
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      order: (column: string) => {
        request.order.push(column);
        return builder;
      },
      range: (start: number, end: number) => {
        request.range = [start, end];
        return builder;
      },
      overrideTypes: () => builder,
      single: async () => first(),
      maybeSingle: async () => first(),
      then: <T>(onOk: (value: ReturnType<typeof execute>) => T) =>
        Promise.resolve(execute()).then(onOk),
    };

    return builder;
  };

  return { from, requests };
}

/** `projectCount` projects with `answersPerProject` answers each. */
export function buildAnswerRows(projectCount: number, answersPerProject: number) {
  return Array.from({ length: projectCount * answersPerProject }, (_, index) => {
    const projectIndex = index % projectCount;
    const fieldIndex = Math.floor(index / projectCount);
    return {
      id: `answer-${index}`,
      project_id: `project-${projectIndex}`,
      event_submission_field_id: `field-${fieldIndex}`,
      answer: `project-${projectIndex} answer ${fieldIndex}`,
    };
  });
}
