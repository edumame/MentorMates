/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const VIEW_STATEMENT =
  /\b(CREATE(?:\s+OR\s+REPLACE)?|DROP)\s+VIEW\s+(?:IF\s+EXISTS\s+)?(?:"?public"?\.)?"?coupons_with_codes"?/gi;

function viewStatementsInMigrationOrder() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) => {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").replace(
        /--.*$/gm,
        ""
      );
      return [...sql.matchAll(VIEW_STATEMENT)].map((match) => ({
        file,
        verb: match[1].split(/\s+/)[0].toUpperCase(),
      }));
    });
}

describe("coupons_with_codes view", () => {
  it("is dropped by the migrations, because it runs as its owner and bypasses promo code RLS", () => {
    const statements = viewStatementsInMigrationOrder();

    // Guards the parser: the view must still be found where it was created.
    expect(statements[0]).toEqual({
      file: "20250920_refactor_promo_codes_table.sql",
      verb: "CREATE",
    });
    expect(statements[statements.length - 1].verb).toBe("DROP");
  });

  it("is not in the generated database types", () => {
    const types = readFileSync(
      path.join(process.cwd(), "lib/database.types.ts"),
      "utf8"
    );

    expect(types.includes("coupons_with_codes")).toBe(false);
  });
});
