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
