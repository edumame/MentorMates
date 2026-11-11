/**
 * @jest-environment node
 */
// EVT-SSR-001: this module is imported by server-rendered client components,
// so it must be importable without `window`.
import {
  addJoinEventFlowQuery,
  hasJoinEventFlowQuery,
  removeJoinEventFlowQuery,
} from "./join-event-url";

describe("join-event-url without window (SSR)", () => {
  it("does not touch window at import time", () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
  });

  it("adds and removes the resume query on local paths", () => {
    const withFlow = addJoinEventFlowQuery("/events/demo/overview?tab=a#x");
    expect(withFlow).toBe("/events/demo/overview?tab=a&joinEventFlow=resume#x");
    expect(hasJoinEventFlowQuery(withFlow!.split("?")[1].split("#")[0])).toBe(true);
    expect(removeJoinEventFlowQuery(withFlow)).toBe("/events/demo/overview?tab=a#x");
  });

  it.each(["https://evil.example/x", "//evil.example/x", "/\\evil.example/x", "events/x", ""])(
    "rejects non-local path %p",
    (path) => {
      expect(addJoinEventFlowQuery(path)).toBeNull();
      expect(removeJoinEventFlowQuery(path)).toBeNull();
    }
  );
});
