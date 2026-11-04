const PAGE_SIZE = 1000;

type RowsResult<T, E> = { data: T[] | null; error: E | null };

/**
 * Reads every row of a query, working around PostgREST `max_rows`, which cuts a
 * response off without any error. `fetchPage` must build a fresh query, apply
 * `.range(from, to)`, and order by a unique column so pages cannot overlap.
 *
 * Paging stops on an empty page, not a short one: the hosted `max_rows` is set
 * outside the repo and may be below PAGE_SIZE, so a short page proves nothing.
 * On failure no rows are returned, so callers cannot mistake them for the whole.
 */
export async function fetchAllRows<T, E>(
  fetchPage: (from: number, to: number) => PromiseLike<RowsResult<T, E>>,
): Promise<{ data: T[]; error: E | null }> {
  const rows: T[] = [];

  while (true) {
    const { data, error } = await fetchPage(
      rows.length,
      rows.length + PAGE_SIZE - 1,
    );

    if (error) return { data: [], error };
    if (!data?.length) return { data: rows, error: null };

    rows.push(...data);
  }
}
