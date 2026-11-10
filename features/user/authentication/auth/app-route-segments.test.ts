/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";
import { APP_ROUTE_SEGMENTS, isUnroutablePath } from "./app-route-segments";

const APP_DIR = path.join(process.cwd(), "app");
const NON_ROUTE_DIRS = new Set(["__tests__", "actions", "utils"]);

function topLevelRouteSegments() {
  const segments: string[] = [];
  for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || NON_ROUTE_DIRS.has(entry.name) || entry.name.startsWith("_")) continue;
    if (entry.name.startsWith("(")) {
      for (const child of fs.readdirSync(path.join(APP_DIR, entry.name), { withFileTypes: true })) {
        if (child.isDirectory() && !child.name.startsWith("_")) segments.push(child.name);
      }
      continue;
    }
    segments.push(entry.name);
  }
  return segments;
}

it("lists exactly the app directory's top-level routes (plus rewrites)", () => {
  const onDisk = topLevelRouteSegments().sort();
  const listed = [...APP_ROUTE_SEGMENTS].filter((s) => s !== "judge-certificate").sort();
  expect(listed).toEqual(onDisk);
});

it("classifies unroutable paths", () => {
  expect(isUnroutablePath("/")).toBe(false);
  expect(isUnroutablePath("/admin")).toBe(false);
  expect(isUnroutablePath("/license")).toBe(false);
  expect(isUnroutablePath("/events/x/overview")).toBe(false);
  expect(isUnroutablePath("/does-not-exist-route")).toBe(true);
  expect(isUnroutablePath("/teams")).toBe(true);
});
