/** @jest-environment node */
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { EventRole } from "@/lib/types";
import { DELETE, POST } from "./route";

jest.mock("bcrypt", () => ({ hash: jest.fn().mockResolvedValue("hashed") }));
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

function setup(callerRole: EventRole | null = EventRole.Organizer, isAdmin = false) {
  (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
    user: { id: "org" },
    rpcResults: { is_admin_user: { data: isAdmin } },
    tables: { user_event_roles: queryMock({ data: callerRole ? { role: callerRole } : null, error: null }) },
  }));
  const passwords = queryMock({ data: null, error: null });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(supabaseMock({ tables: { role_passwords: passwords } }));
  return passwords;
}

const call = (fn: typeof POST, body: Record<string, unknown>) =>
  fn(new Request("http://localhost/api/roles/set-password", { method: "POST", body: JSON.stringify(body) }));

describe("/api/roles/set-password (ORG-013)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects 1-character passwords", async () => {
    const passwords = setup();
    const res = await call(POST, { eventId: "e", role: EventRole.Judge, password: "x" });
    expect(res.status).toBe(400);
    expect(passwords.upsert).not.toHaveBeenCalled();
  });

  it("refuses organizer role passwords", async () => {
    const passwords = setup();
    const res = await call(POST, { eventId: "e", role: EventRole.Organizer, password: "a-very-long-password" });
    expect(res.status).toBe(400);
    expect(passwords.upsert).not.toHaveBeenCalled();
  });

  it("stores a hash for a valid judge password", async () => {
    const passwords = setup();
    const res = await call(POST, { eventId: "e", role: EventRole.Judge, password: "a-long-judge-pass" });
    expect(res.status).toBe(200);
    expect(passwords.upsert).toHaveBeenCalledWith(expect.objectContaining({ role: EventRole.Judge, password_hash: "hashed" }), { onConflict: "event_id,role" });
  });

  it("forbids non-organizers", async () => {
    const passwords = setup(EventRole.Participant);
    expect((await call(POST, { eventId: "e", role: EventRole.Mentor, password: "a-long-mentor-pw" })).status).toBe(403);
    expect((await call(DELETE, { eventId: "e", role: EventRole.Mentor })).status).toBe(403);
    expect(passwords.delete).not.toHaveBeenCalled();
  });

  it("lets organizers remove a password", async () => {
    const passwords = setup();
    const res = await call(DELETE, { eventId: "e", role: EventRole.Mentor });
    expect(res.status).toBe(200);
    expect(passwords.delete).toHaveBeenCalled();
    expect(passwords.eq).toHaveBeenCalledWith("role", EventRole.Mentor);
  });

  it("returns 401 without a session", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({ user: null }));
    expect((await call(POST, { eventId: "e", role: EventRole.Judge, password: "a-long-judge-pass" })).status).toBe(401);
  });
});
