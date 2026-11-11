import { applyTeammateChanges } from "./teammates";

describe("applyTeammateChanges", () => {
  it("keeps stored teammates the caller did not know about", () => {
    expect(
      applyTeammateChanges(["joined@x.com"], { add: ["new@x.com"] }),
    ).toEqual(["joined@x.com", "new@x.com"]);
  });

  it("removes only the requested teammates", () => {
    expect(
      applyTeammateChanges(["a@x.com", "joined@x.com"], { remove: ["a@x.com"] }),
    ).toEqual(["joined@x.com"]);
  });

  it("matches emails case-insensitively and keeps the stored spelling", () => {
    expect(
      applyTeammateChanges(["Joined@X.com", "gone@x.com"], {
        add: ["joined@x.com"],
        remove: ["GONE@x.com"],
      }),
    ).toEqual(["Joined@X.com"]);
  });

  it("is idempotent, so a repeated autosave changes nothing", () => {
    const changes = { add: ["a@x.com"], remove: ["b@x.com"] };
    const once = applyTeammateChanges(["b@x.com", "c@x.com"], changes);
    expect(applyTeammateChanges(once, changes)).toEqual(once);
  });

  it("does not add the same email twice in one change", () => {
    expect(
      applyTeammateChanges([], { add: ["a@x.com", "A@x.com"] }),
    ).toEqual(["a@x.com"]);
  });

  it("treats a missing stored list as empty", () => {
    expect(applyTeammateChanges(null, { add: ["a@x.com"] })).toEqual([
      "a@x.com",
    ]);
  });
});
