import { floatingPlacement } from "@/lib/shipcue/placement";

describe("floatingPlacement", () => {
  it.each([
    [null, "default"],
    ["/", "default"],
    ["/events/123", "default"],
    ["/chat", "chat"],
    ["/chat/meeting-1", "chat"],
    ["/projects/submit", "mobile-bar"],
    ["/projects/submit/", "mobile-bar"],
    ["/projects/123", "default"],
  ])("%s → %s", (path, expected) => {
    expect(floatingPlacement(path)).toBe(expected);
  });
});
