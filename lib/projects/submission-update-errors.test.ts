import { mapProjectUpdateError } from "./submission-service";

describe("mapProjectUpdateError", () => {
  it("maps the scored/prized/voted event-move guard to 400", () => {
    expect(mapProjectUpdateError({ code: "23514" })).toMatchObject({ status: 400, error: expect.stringMatching(/scores, prizes, votes or a round advancement/) });
  });
  it("maps the not-joined target event guard to 403", () => {
    expect(mapProjectUpdateError({ code: "42501" })).toMatchObject({ status: 403 });
  });
  it("leaves other errors to the generic 500", () => {
    expect(mapProjectUpdateError({ code: "XX000" })).toBeNull();
  });
});
