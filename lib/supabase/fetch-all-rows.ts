const PAGE_SIZE = 1000;

/**
 * Reads every row of a query. PostgREST truncates a select at its `max_rows`
 * setting with a normal 200 response, so anything that counts or ranks rows in
 * application code has to page through them.
 *
 * `fetchPage` must apply `.range(from, to)` and an `.order()` ending in a unique
 * column, otherwise pages can overlap or skip rows. Paging stops on an empty
 * page rather than a short one, so a server cap below PAGE_SIZE loses nothing.
 */
export async function fetchAllRows<Row, Err>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Row[] | null; error: Err | null }>
): Promise<{ data: Row[]; error: null } | { data: null; error: Err }> {
  const rows: Row[] = [];

  while (true) {
    const { data, error } = await fetchPage(
      rows.length,
      rows.length + PAGE_SIZE - 1
    );
    if (error) return { data: null, error };
    if (!data?.length) return { data: rows, error: null };
    rows.push(...data);
  }
}
