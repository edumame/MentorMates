import { applyTeamChange, diffTeamEmails } from "./teamChange";

describe("diffTeamEmails", () => {
  it("reports added and removed emails", () => {
    expect(diffTeamEmails(["a@x.io", "b@x.io"], ["b@x.io", "c@x.io"])).toEqual({
      added: ["c@x.io"],
      removed: ["a@x.io"],
    });
  });

  it("treats emails that differ only by case as unchanged", () => {
    expect(diffTeamEmails(["A@x.io"], ["a@x.io"])).toEqual({
      added: [],
      removed: [],
    });
  });
});

describe("applyTeamChange", () => {
  it("keeps members the change does not mention", () => {
    expect(
      applyTeamChange(["joined@x.io", "a@x.io"], {
        added: ["b@x.io"],
        removed: ["a@x.io"],
      })
    ).toEqual(["joined@x.io", "b@x.io"]);
  });

  it("does not add an email that is already on the team in another case", () => {
    expect(
      applyTeamChange(["Joined@x.io"], { added: ["joined@x.io"], removed: [] })
    ).toEqual(["Joined@x.io"]);
  });

  it("removes an email regardless of case", () => {
    expect(
      applyTeamChange(["Gone@x.io", "a@x.io"], {
        added: [],
        removed: ["gone@x.io"],
      })
    ).toEqual(["a@x.io"]);
  });

  it("ignores a removal of an email that is no longer on the team", () => {
    expect(
      applyTeamChange(["a@x.io"], { added: [], removed: ["gone@x.io"] })
    ).toEqual(["a@x.io"]);
  });
});
