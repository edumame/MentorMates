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
