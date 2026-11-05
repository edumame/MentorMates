import { fetchAllRows } from "./fetch-all-rows";
import { createCappedQuery } from "./capped-query.test-helper";

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ index }));

describe("fetchAllRows", () => {
  it("returns every row when the total exceeds the row cap", async () => {
    const query = createCappedQuery(rows(2500));

    const result = await fetchAllRows((from, to) => query.range(from, to));

    expect(result.error).toBeNull();
    expect(result.data).toEqual(rows(2500));
  });

  it("returns an exact multiple of the page size without losing rows", async () => {
    const query = createCappedQuery(rows(2000));

    const result = await fetchAllRows((from, to) => query.range(from, to));

    expect(result.data).toHaveLength(2000);
  });

  it("keeps paging when the server cap is below the page size", async () => {
    const query = createCappedQuery(rows(1200), { maxRows: 300 });

    const result = await fetchAllRows((from, to) => query.range(from, to));

    expect(result.data).toEqual(rows(1200));
  });

  it("returns no rows for an empty result", async () => {
    const query = createCappedQuery([]);

    await expect(
      fetchAllRows((from, to) => query.range(from, to)),
    ).resolves.toEqual({ data: [], error: null });
  });

  it("returns the error instead of partial rows when a later page fails", async () => {
    const failure = { message: "boom" };
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ data: rows(1000), error: null })
      .mockResolvedValueOnce({ data: null, error: failure });

    await expect(fetchAllRows(fetchPage)).resolves.toEqual({
      data: [],
      error: failure,
    });
  });
});
