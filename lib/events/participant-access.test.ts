import type { ServiceSupabaseClient } from "@/lib/supabase/service";
import { joinParticipantEvent } from "./participant-access";

function harness(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
  const event = { event_id: "event-1", event_name: "Fixture", visibility: "public", approval_status: "approved",
    paid: false, require_participant_approval: false, participant_capacity: null, ...overrides };
  const insert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn((table: string) => {
    const q: Record<string, jest.Mock> = {};
    for (const method of ["select", "eq", "order", "limit", "maybeSingle", "single"]) q[method] = jest.fn(() => q);
    q.overrideTypes = jest.fn().mockResolvedValue({ data: table === "events" ? event : data[table] ?? null, error: null });
    q.insert = insert;
    return q;
  });
  return { client: { from } as unknown as ServiceSupabaseClient, from, insert };
}
const options = { eventId: "event-1", userId: "user-1", channel: "web" as const };

describe("participant enrollment requirements", () => {
  it("joins free approved events with an insert that cannot overwrite a concurrent staff role", async () => {
    const h = harness();
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ role: "participant", user_id: "user-1" }));
  });
  it.each([true, false])("requires paid entitlement independently of approval configuration (%s)", async (approval) => {
    const h = harness({ paid: true, require_participant_approval: approval }, {
      participant_approval_requests: approval ? { id: "request", status: "approved" } : null,
    });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 402 });
    expect(h.insert).not.toHaveBeenCalled();
  });
  it("allows paid entitlement after all independent requirements", async () => {
    const h = harness({ paid: true }, { user_event_payments: { payment_status: "paid" } });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
  });
  it.each([
    { visibility: "draft", approval_status: "approved" },
    { visibility: "public", approval_status: "submitted" },
    { visibility: "private", approval_status: "rejected" },
    { visibility: "archived", approval_status: "approved" },
    { visibility: "archived", approval_status: "not_submitted" },
  ])("rejects closed enrollment state %o before mutation", async (state) => {
    const h = harness(state);
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 403 });
    expect(h.insert).not.toHaveBeenCalled();
  });
  it("rejects agent joins of archived events before mutation (XL-001)", async () => {
    const h = harness({ visibility: "archived", approval_status: "approved" });
    expect(await joinParticipantEvent(h.client, { ...options, channel: "agent" })).toMatchObject({ status: "error", httpStatus: 403 });
    expect(h.insert).not.toHaveBeenCalled();
  });
  it("preserves private non-listed events without requiring public-listing approval", async () => {
    const h = harness({ visibility: "private", approval_status: "not_submitted" });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
  });
  it("blocks agent access to paid or password-protected events", async () => {
    for (const h of [harness({ paid: true }), harness({}, { role_passwords: { role: "participant" } })]) {
      expect(await joinParticipantEvent(h.client, { ...options, channel: "agent" })).toMatchObject({ status: "error", httpStatus: 403 });
      expect(h.insert).not.toHaveBeenCalled();
    }
  });
  it("maps the serialized capacity rejection to a conflict", async () => {
    const h = harness(); h.insert.mockResolvedValue({ error: { code: "45000" } });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 409 });
  });
  it("preserves a concurrently assigned role", async () => {
    const h = harness(); h.insert.mockResolvedValue({ error: { code: "23505" } });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 409 });
  });
  describe("registration questionnaire version (ORG-010)", () => {
    const binding = { event_intake_form_bindings: { form_version_id: "v2" } };
    it("requires a submission when a registration form is active", async () => {
      const h = harness({}, binding);
      expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 412 });
      expect(h.insert).not.toHaveBeenCalled();
    });
    it("rejects a submission for an older form version", async () => {
      const h = harness({}, { ...binding, intake_form_submissions: { id: "s1", form_version_id: "v1" } });
      expect(await joinParticipantEvent(h.client, options)).toMatchObject({
        status: "error",
        httpStatus: 412,
        payload: expect.objectContaining({ questionnaire_outdated: true }),
      });
      expect(h.insert).not.toHaveBeenCalled();
    });
    it("joins with a submission for the active form version", async () => {
      const h = harness({}, { ...binding, intake_form_submissions: { id: "s1", form_version_id: "v2" } });
      expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
    });
  });
});
