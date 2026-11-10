/**
 * Test double for a PostgREST select. Like the real server it silently returns
 * at most `maxRows` rows with no error, and honours `.range()`. Paging without
 * an `.order()` is reported as an error, because unordered pages can overlap.
 */
export function cappedQuery<Row>(rows: Row[], maxRows = 1000) {
  let offset = 0;
  let limit = Infinity;
  let paged = false;
  let ordered = false;

  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => {
      ordered = true;
      return query;
    },
    range: (from: number, to: number) => {
      paged = true;
      offset = from;
      limit = to - from + 1;
      return query;
    },
    then: <Result>(
      resolve: (response: {
        data: Row[] | null;
        error: { message: string } | null;
      }) => Result
    ) =>
      Promise.resolve(
        resolve(
          paged && !ordered
            ? { data: null, error: { message: "paged without an order" } }
            : {
                data: rows.slice(offset, offset + Math.min(limit, maxRows)),
                error: null,
              }
        )
      ),
  };

  return query;
}

// jest.fn-based variant with an error option, used by lib/agent/event-access tests.
type CappedQueryOptions = {
  /** Mirrors PostgREST `max_rows`: no response carries more rows than this. */
  maxRows?: number;
  error?: { message: string } | null;
};

/**
 * Fake Supabase query builder that truncates like PostgREST: a request over the
 * row cap still resolves successfully, with the extra rows silently missing.
 * Filters are recorded but not applied, so pass the rows the filters would match.
 */
export function createCappedQuery<T>(
  rows: T[],
  { maxRows = 1000, error = null }: CappedQueryOptions = {},
) {
  let requested: [number, number] = [0, Number.MAX_SAFE_INTEGER];

  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range(from: number, to: number) {
      requested = [from, to];
      return this;
    },
    then: ((onFulfilled, onRejected) => {
      const [from, to] = requested;
      const data = error
        ? null
        : rows.slice(from, Math.min(to + 1, from + maxRows));
      return Promise.resolve({ data, error }).then(onFulfilled, onRejected);
    }) as Promise<{
      data: T[] | null;
      error: { message: string } | null;
    }>["then"],
  };

  return query;
}
