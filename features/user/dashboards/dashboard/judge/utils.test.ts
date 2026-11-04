import {
  getNextProjectId,
  isProjectFullyScored,
  shouldHandleCardArrowKey,
  truncateWithEllipsis,
} from "./utils";

describe("judge dashboard utils", () => {
  describe("isProjectFullyScored", () => {
    it("returns true when all tracks are scored", () => {
      const scoredProjects = new Map<string, Set<string>>([
        ["project-1", new Set(["track-a", "track-b"])],
      ]);

      const result = isProjectFullyScored(
        {
          id: "project-1",
          track_ids: ["track-a", "track-b"],
        },
        scoredProjects
      );

      expect(result).toBe(true);
    });

    it("returns false when at least one track is missing", () => {
      const scoredProjects = new Map<string, Set<string>>([
        ["project-1", new Set(["track-a"])],
      ]);

      const result = isProjectFullyScored(
        {
          id: "project-1",
          track_ids: ["track-a", "track-b"],
        },
        scoredProjects
      );

      expect(result).toBe(false);
    });

    it("returns false for projects without tracks so assigned projects stay visible", () => {
      const scoredProjects = new Map<string, Set<string>>();

      const result = isProjectFullyScored(
        {
          id: "project-1",
          track_ids: [],
        },
        scoredProjects
      );

      expect(result).toBe(false);
    });
  });

  describe("getNextProjectId", () => {
    const projects = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

    it("returns null for empty decks", () => {
      expect(getNextProjectId([], "p1", 1)).toBeNull();
    });

    it("returns first project when current is missing", () => {
      expect(getNextProjectId(projects, "unknown", 1)).toBe("p1");
    });

    it("wraps forward navigation", () => {
      expect(getNextProjectId(projects, "p3", 1)).toBe("p1");
    });

    it("wraps backward navigation", () => {
      expect(getNextProjectId(projects, "p1", -1)).toBe("p3");
    });
  });

  describe("truncateWithEllipsis", () => {
    it("returns full text when under the limit", () => {
      expect(truncateWithEllipsis("hello", 10)).toBe("hello");
    });

    it("truncates text and appends ellipsis", () => {
      expect(truncateWithEllipsis("hello world", 5)).toBe("hello...");
    });
  });

  describe("shouldHandleCardArrowKey", () => {
    function pressArrowOn(target: EventTarget, init: KeyboardEventInit = {}) {
      let handled: boolean | undefined;
      const listener = (event: Event) => {
        handled = shouldHandleCardArrowKey(event as KeyboardEvent);
      };
      window.addEventListener("keydown", listener);
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
          ...init,
        })
      );
      window.removeEventListener("keydown", listener);
      return handled;
    }

    function mount(html: string) {
      document.body.innerHTML = html;
      return document.querySelector("[data-target]") as HTMLElement;
    }

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("handles arrows pressed on the page or on a plain button", () => {
      expect(pressArrowOn(document.body)).toBe(true);
      expect(pressArrowOn(window)).toBe(true);
      expect(pressArrowOn(mount("<button data-target>Next</button>"))).toBe(true);
      expect(pressArrowOn(mount("<div contenteditable='false' data-target></div>"))).toBe(
        true
      );
    });

    it.each([
      ["input", "<input data-target />"],
      ["textarea", "<textarea data-target></textarea>"],
      ["select", "<select data-target></select>"],
      ["slider", "<span role='slider' tabindex='0' data-target></span>"],
      ["contenteditable", "<div contenteditable='true' data-target></div>"],
      ["child of contenteditable", "<div contenteditable><b data-target>x</b></div>"],
      ["button inside a form", "<form><button data-target>Submit</button></form>"],
      [
        "button inside an alert dialog",
        "<div role='alertdialog'><button data-target>Cancel</button></div>",
      ],
    ])("ignores arrows pressed in a %s", (_name, html) => {
      expect(pressArrowOn(mount(html))).toBe(false);
    });

    it("ignores arrows another handler already consumed", () => {
      const target = mount("<div data-target></div>");
      target.addEventListener("keydown", (event) => event.preventDefault());

      expect(pressArrowOn(target)).toBe(false);
    });

    it.each(["altKey", "ctrlKey", "metaKey", "shiftKey"])(
      "ignores arrows combined with %s",
      (modifier) => {
        expect(pressArrowOn(document.body, { [modifier]: true })).toBe(false);
      }
    );
  });
});
