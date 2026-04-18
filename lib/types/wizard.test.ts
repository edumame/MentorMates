import { buildApiPayload, INITIAL_WIZARD_EVENT } from "./wizard";

describe("buildApiPayload", () => {
  it("includes max_projects when configured", () => {
    const payload = buildApiPayload({
      ...INITIAL_WIZARD_EVENT,
      event_name: "Hack Night",
      event_date: "2026-04-18",
      location: "Online",
      max_projects: 25,
    });

    expect(payload.event.max_projects).toBe(25);
  });
});
