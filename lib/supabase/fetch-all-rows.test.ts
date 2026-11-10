import { cappedQuery } from "./capped-query.test-helper";
import { fetchAllRows } from "./fetch-all-rows";

const rowsOf = (length: number) =>
  Array.from({ length }, (_, index) => ({ index }));

function fetchPaged(rows: { index: number }[], maxRows?: number) {
  return fetchAllRows((from, to) =>
    cappedQuery(rows, maxRows).order().range(from, to)
  );
}

describe("fetchAllRows", () => {
  it("returns an empty list when there are no rows", async () => {
    await expect(fetchPaged([])).resolves.toEqual({ data: [], error: null });
  });

  it.each([1, 999, 1000, 1001, 2000, 2500])(
    "returns all %i rows in order",
    async (count) => {
      const rows = rowsOf(count);
      const { data, error } = await fetchPaged(rows);

      expect(error).toBeNull();
      expect(data).toEqual(rows);
    }
  );

  it("keeps every row when the server cap is below the page size", async () => {
    const rows = rowsOf(1200);
    const { data } = await fetchPaged(rows, 500);

    expect(data).toEqual(rows);
  });

  it("returns the error, not partial rows, when a later page fails", async () => {
    const failure = { message: "boom" };
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ data: rowsOf(1000), error: null })
      .mockResolvedValueOnce({ data: null, error: failure });

    await expect(fetchAllRows(fetchPage)).resolves.toEqual({
      data: null,
      error: failure,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});
