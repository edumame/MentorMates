/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";
import { lookupByEventRouteParam, resolveEventRouteId } from "./resolve-event-route";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

function client(rows: Record<string, { event_id: string } | null>) {
  const calls: string[] = [];
  return {
    calls,
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            calls.push(`${column}=${value}`);
            return { data: rows[`${column}=${value}`] ?? null, error: null };
          },
        }),
      }),
    }),
  };
}

describe("event route resolution (ORG-014)", () => {
  it("matches a UUID by event_id before slug, so a UUID-shaped slug cannot shadow it", async () => {
    const c = client({ [`event_id=${UUID}`]: { event_id: UUID }, [`slug=${UUID}`]: { event_id: "shadow" } });
    await expect(resolveEventRouteId(c as never, UUID)).resolves.toBe(UUID);
    expect(c.calls).toEqual([`event_id=${UUID}`]);
  });

  it("falls back to slug for a UUID that is not an event id", async () => {
    const c = client({ [`slug=${UUID}`]: { event_id: "legacy" } });
    await expect(resolveEventRouteId(c as never, UUID)).resolves.toBe("legacy");
  });

  it("looks up non-UUID params only by slug", async () => {
    const c = client({ "slug=spring-hack": { event_id: "e1" } });
    await expect(resolveEventRouteId(c as never, "spring-hack")).resolves.toBe("e1");
    expect(c.calls).toEqual(["slug=spring-hack"]);
  });

  it("returns null for empty or unknown params", async () => {
    await expect(resolveEventRouteId(client({}) as never, "")).resolves.toBeNull();
    await expect(resolveEventRouteId(client({}) as never, "nope")).resolves.toBeNull();
  });

  it("stops at an id-lookup error instead of falling through to slug", async () => {
    const lookup = jest.fn(async () => ({ data: null, error: { code: "42501" } }));
    const result = await lookupByEventRouteParam(UUID, lookup);
    expect(result.error).toEqual({ code: "42501" });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("no event page resolves its param with the old slug-or-id filter", () => {
    const roots = [path.join(process.cwd(), "app/events/[id]"), path.join(process.cwd(), "app/projects/submit")];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) && fs.readFileSync(full, "utf8").includes("slug.eq.${")) offenders.push(full);
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
