/**
 * Minimal in-memory Supabase fake for the device auth route tests.
 *
 * Each query executes as one atomic statement when awaited, which mirrors
 * Postgres statement semantics: requests run with Promise.all interleave at
 * their awaits exactly like concurrent HTTP requests would, so conditional
 * UPDATE/DELETE races are exercised for real.
 */

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update" | "delete";
type Filter = (row: Row) => boolean;
type DbError = { message: string; code?: string };

const UNIQUE_COLUMNS: Record<string, string[]> = {
  device_auth_codes: ["device_code_hash", "user_code"],
  agent_api_keys: ["key_hash"],
};

function compareValues(a: unknown, b: unknown): number {
  const toComparable = (v: unknown) => {
    if (typeof v === "string" && !Number.isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}T/.test(v)) {
      return Date.parse(v);
    }
    return v as number;
  };
  const x = toComparable(a);
  const y = toComparable(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {
    device_auth_codes: [],
    agent_api_keys: [],
    user_event_roles: [],
  };
  admins = new Set<string>();
  rateLimits = new Map<string, number>();
  /** Queued one-shot failures: matched by table + op. */
  failures: Array<{ table: string; op: Op; error: DbError }> = [];
  rpcFailures = new Map<string, DbError>();
  calls: Array<{ table: string; op: Op }> = [];
  private nextId = 1;

  failNext(table: string, op: Op, error: DbError = { message: "boom" }) {
    this.failures.push({ table, op, error });
  }

  newId(prefix: string) {
    return `${prefix}-${this.nextId++}`;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(name: string, args: Record<string, unknown>) {
    const failure = this.rpcFailures.get(name);
    if (failure) return { data: null, error: failure };

    if (name === "is_admin_user") {
      return { data: this.admins.has(args.user_id as string), error: null };
    }
    if (name === "reserve_device_auth_attempt") {
      const bucket = args.p_bucket as string;
      const limit = args.p_limit as number;
      const used = this.rateLimits.get(bucket) ?? 0;
      if (used >= limit) {
        return { data: [{ allowed: false, retry_after_seconds: 120 }], error: null };
      }
      this.rateLimits.set(bucket, used + 1);
      return { data: [{ allowed: true, retry_after_seconds: 0 }], error: null };
    }
    return { data: null, error: { message: `unknown rpc ${name}` } };
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: DbError | null; count?: number | null }> {
  private op: Op = "select";
  private filters: Filter[] = [];
  private payload: Row | Row[] | null = null;
  private returning = false;
  private headCount = false;
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(private db: FakeSupabase, private table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.headCount = Boolean(options?.head);
    } else {
      this.returning = true;
    }
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.payload = values;
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.payload = values;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push((row) => compareValues(row[column], value) > 0);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  then<TResult1 = { data: unknown; error: DbError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: DbError | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: DbError | null; count?: number | null } {
    this.db.calls.push({ table: this.table, op: this.op });
    const failureIndex = this.db.failures.findIndex(
      (f) => f.table === this.table && f.op === this.op,
    );
    if (failureIndex >= 0) {
      const [failure] = this.db.failures.splice(failureIndex, 1);
      return { data: null, error: failure.error, count: null };
    }

    const rows = (this.db.tables[this.table] ??= []);
    const matches = () => rows.filter((row) => this.filters.every((f) => f(row)));
    let result: Row[] = [];

    if (this.op === "select") {
      result = matches();
      if (this.headCount) return { data: null, error: null, count: result.length };
    } else if (this.op === "insert") {
      const inserts = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      for (const values of inserts) {
        for (const column of UNIQUE_COLUMNS[this.table] ?? []) {
          if (rows.some((row) => row[column] === values[column])) {
            return {
              data: null,
              error: { message: "duplicate key value violates unique constraint", code: "23505" },
            };
          }
        }
      }
      result = inserts.map((values) => ({ id: this.db.newId(this.table), ...values }));
      rows.push(...result);
    } else if (this.op === "update") {
      result = matches();
      for (const row of result) Object.assign(row, this.payload);
    } else {
      result = matches();
      this.db.tables[this.table] = rows.filter((row) => !result.includes(row));
    }

    const data = this.op === "select" || this.returning ? result.map((r) => ({ ...r })) : null;
    if (this.mode === "many") return { data, error: null };
    if (data && data.length > 1) {
      return { data: null, error: { message: "multiple rows", code: "PGRST116" } };
    }
    if (this.mode === "single" && (!data || data.length === 0)) {
      return { data: null, error: { message: "no rows", code: "PGRST116" } };
    }
    return { data: data?.[0] ?? null, error: null };
  }
}
