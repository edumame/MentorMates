import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Execute the real migration with Supabase's roles/auth.uid contract in an
// isolated PostgreSQL engine. No credentials or application database required.
const db = new PGlite();
let checks = 0;
async function check(name, action) {
  await action();
  checks++;
  console.log(`PASS ${name}`);
}
const owner = randomUUID();
const other = randomUUID();
const keyId = randomUUID();
const secondKeyId = randomUUID();
const call = (requestId = randomUUID(), key = keyId, minute = 2, day = 3) =>
  db.query(
    "SELECT * FROM public.begin_model_api_request($1, $2, $3, $4, $5, $6, $7)",
    [
      owner,
      key,
      requestId,
      JSON.stringify({ state: "hello", questions: {} }),
      "jev-latest",
      minute,
      day,
    ],
  );
async function asUser(user, action) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [
    user,
  ]);
  await db.exec("SET ROLE authenticated");
  try {
    return await action();
  } finally {
    await db.exec("RESET ROLE");
  }
}
try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260919_model_gateway.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("INSERT INTO auth.users VALUES ($1), ($2)", [owner, other]);
  await db.query(
    "INSERT INTO public.model_api_keys(id,user_id,key_hash,key_prefix,label) VALUES ($1,$2,$3,'mm_model_a','Primary'),($4,$2,$5,'mm_model_b','Secondary')",
    [keyId, owner, "a".repeat(64), secondKeyId, "b".repeat(64)],
  );

  await check(
    "migration creates a durable request and shares quota across keys",
    async () => {
      assert.equal((await call()).rows[0].allowed, true);
      assert.equal(
        (await call(randomUUID(), secondKeyId)).rows[0].allowed,
        true,
      );
      const denied = (await call()).rows[0];
      assert.equal(denied.allowed, false);
      assert.ok(denied.retry_after > 0 && denied.retry_after <= 60);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS total FROM model_api_requests",
          )
        ).rows[0].total,
        3,
      );
    },
  );
  await check("owner reads own requests and safe key metadata", async () =>
    asUser(owner, async () => {
      assert.equal(
        (await db.query("SELECT id FROM model_api_keys")).rows.length,
        2,
      );
      assert.equal(
        (await db.query("SELECT * FROM model_api_requests")).rows.length,
        3,
      );
      await assert.rejects(
        db.query("SELECT key_hash FROM model_api_keys"),
        /permission denied/,
      );
    }),
  );
  await check("another account cannot read keys or requests", async () =>
    asUser(other, async () => {
      assert.equal(
        (await db.query("SELECT id FROM model_api_keys")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("SELECT * FROM model_api_requests")).rows.length,
        0,
      );
    }),
  );
  await check(
    "account holders cannot forge keys, history, quotas, or reservations",
    async () =>
      asUser(owner, async () => {
        await assert.rejects(
          db.query(
            "INSERT INTO model_api_keys(user_id,key_hash,key_prefix,label) VALUES ($1,$2,'prefix','forged')",
            [owner, "c".repeat(64)],
          ),
          /permission denied/,
        );
        await assert.rejects(
          db.query("UPDATE model_api_keys SET revoked_at = null"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("DELETE FROM model_api_requests"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("SELECT * FROM model_api_limits"),
          /permission denied/,
        );
        await assert.rejects(call(), /permission denied/);
      }),
  );
  await check(
    "anonymous users cannot access gateway data or the privileged function",
    async () => {
      await db.exec("SET ROLE anon");
      try {
        await assert.rejects(
          db.query("SELECT id FROM model_api_keys"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("SELECT * FROM model_api_requests"),
          /permission denied/,
        );
        await assert.rejects(call(), /permission denied/);
      } finally {
        await db.exec("RESET ROLE");
      }
    },
  );
  await check("minute rollover preserves the daily allowance", async () => {
    await db.query(
      "UPDATE model_api_limits SET minute_start = now() - interval '2 minutes'",
    );
    assert.equal((await call()).rows[0].allowed, true);
    const denied = (await call()).rows[0];
    assert.equal(denied.allowed, false);
    assert.ok(denied.retry_after > 0 && denied.retry_after <= 86400);
  });
  await check("UTC day rollover resets both windows", async () => {
    await db.query(
      "UPDATE model_api_limits SET minute_start = now() - interval '2 days', day_start = now() - interval '2 days'",
    );
    assert.equal((await call()).rows[0].allowed, true);
  });
  await check("failed reservation rolls back quota increment", async () => {
    const id = randomUUID();
    await call(id, keyId, 100, 100);
    const before = (
      await db.query(
        "SELECT minute_count FROM model_api_limits WHERE user_id = $1",
        [owner],
      )
    ).rows[0].minute_count;
    await assert.rejects(call(id, keyId, 100, 100), /duplicate key/);
    assert.equal(
      (
        await db.query(
          "SELECT minute_count FROM model_api_limits WHERE user_id = $1",
          [owner],
        )
      ).rows[0].minute_count,
      before,
    );
  });
  await check(
    "revocation and expiry are checked in the database before admission",
    async () => {
      await db.query(
        "UPDATE model_api_keys SET revoked_at = now() WHERE id = $1",
        [keyId],
      );
      await assert.rejects(call(), /Invalid model API key/);
      await db.query(
        "UPDATE model_api_keys SET expires_at = now() - interval '1 second' WHERE id = $1",
        [secondKeyId],
      );
      await assert.rejects(
        call(randomUUID(), secondKeyId),
        /Invalid model API key/,
      );
      await db.query(
        "UPDATE model_api_keys SET revoked_at = null, expires_at = null",
      );
    },
  );
  await check("key/account mismatch cannot reserve a request", async () => {
    await assert.rejects(
      db.query(
        "SELECT * FROM begin_model_api_request($1,$2,$3,null,'jev-latest',60,1000)",
        [other, keyId, randomUUID()],
      ),
      /Invalid model API key/,
    );
  });
  await check("trusted service role can record full responses", async () => {
    await db.exec("SET ROLE service_role");
    try {
      const id = randomUUID();
      await call(id, keyId, 100, 100);
      await db.query(
        "UPDATE model_api_requests SET response_body = $2, state = 'succeeded', http_status = 200 WHERE id = $1",
        [
          id,
          JSON.stringify({ answers: { test: { type: "noul", noul: 0.9 } } }),
        ],
      );
      assert.equal(
        (
          await db.query(
            "SELECT response_body FROM model_api_requests WHERE id=$1",
            [id],
          )
        ).rows[0].response_body.answers.test.noul,
        0.9,
      );
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  await check(
    "deleting the account removes keys, request bodies, and counters",
    async () => {
      await db.query("DELETE FROM auth.users WHERE id = $1", [owner]);
      for (const table of [
        "model_api_keys",
        "model_api_requests",
        "model_api_limits",
      ]) {
        assert.equal(
          (await db.query(`SELECT count(*)::int AS total FROM ${table}`))
            .rows[0].total,
          0,
        );
      }
    },
  );
  console.log(`\n${checks} database checks passed.`);
} finally {
  await db.close();
}
