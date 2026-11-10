import { loadProfileCompletionFields, profileNeedsCompletion } from "./profile-completion";

function client(profile: unknown, phones: unknown[], profileError: unknown = null) {
  const chain = (result: unknown) => {
    const self: Record<string, unknown> = new Proxy({}, {
      get(_t, prop) {
        if (prop === "then") return (resolve: (v: unknown) => unknown) => resolve(result);
        if (prop === "maybeSingle") return async () => result;
        return () => self;
      },
    });
    return self;
  };
  return {
    from: (table: string) =>
      table === "user_profiles"
        ? chain({ data: profile, error: profileError })
        : chain({ data: phones, error: null }),
  };
}

describe("loadProfileCompletionFields (MENT-019)", () => {
  const profile = { affiliation: "Uni", links: { linkedin: "https://linkedin.com/in/x" } };
  it("reads the phone number from user_phone_numbers so the reminder clears", async () => {
    const fields = await loadProfileCompletionFields(client(profile, [{ phone_number: "+1 555" }]), "u1");
    expect(fields).toEqual({ ...profile, phone_number: "+1 555" });
    expect(profileNeedsCompletion(fields)).toBe(false);
  });
  it("still asks for a phone number when none is saved", async () => {
    const fields = await loadProfileCompletionFields(client(profile, []), "u1");
    expect(profileNeedsCompletion(fields)).toBe(true);
  });
  it("returns null when the profile cannot be read", async () => {
    expect(await loadProfileCompletionFields(client(null, [], { message: "x" }), "u1")).toBeNull();
  });
});
