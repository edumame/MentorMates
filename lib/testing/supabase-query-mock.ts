/**
 * Test-only helper: a chainable PostgREST query mock. Every builder method
 * returns the same object; awaiting it (or calling single/maybeSingle)
 * resolves to `result`. Calls are recorded on the jest.fn()s for assertions.
 */
export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

const BUILDER_METHODS = [
  "select", "eq", "neq", "in", "order", "range", "limit",
  "insert", "update", "upsert", "delete", "overrideTypes", "is", "match",
] as const;

export type QueryMock = Record<(typeof BUILDER_METHODS)[number] | "single" | "maybeSingle", jest.Mock> &
  PromiseLike<QueryResult>;

export function queryMock(result: QueryResult = { data: null, error: null }): QueryMock {
  const query = {} as QueryMock;
  for (const method of BUILDER_METHODS) {
    (query as unknown as Record<string, jest.Mock>)[method] = jest.fn(() => query);
  }
  query.single = jest.fn(() => Promise.resolve(result));
  query.maybeSingle = jest.fn(() => Promise.resolve(result));
  (query as unknown as { then: PromiseLike<QueryResult>["then"] }).then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

/**
 * Builds a client whose `from(table)` returns queued mocks per table (last one
 * repeats) and whose `rpc(name)` resolves from `rpcResults`.
 */
export function supabaseMock({
  tables = {},
  rpcResults = {},
  user = null,
}: {
  tables?: Record<string, QueryMock | QueryMock[]>;
  rpcResults?: Record<string, QueryResult>;
  user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;
}) {
  const queues: Record<string, QueryMock[]> = {};
  for (const [table, mocks] of Object.entries(tables)) {
    queues[table] = Array.isArray(mocks) ? [...mocks] : [mocks];
  }
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: jest.fn((table: string) => {
      const queue = queues[table];
      if (!queue || queue.length === 0) throw new Error(`Unexpected table ${table}`);
      return queue.length > 1 ? queue.shift()! : queue[0];
    }),
    rpc: jest.fn((name: string) => Promise.resolve(rpcResults[name] ?? { data: null, error: null })),
  };
}
