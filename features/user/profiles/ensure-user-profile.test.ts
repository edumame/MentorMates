import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensureUserProfile } from "./ensure-user-profile";

const user: User = {
  id: "test-user", email: "builder@example.test", user_metadata: { full_name: "Builder Name" },
  app_metadata: {}, aud: "authenticated",
  created_at: "2020-01-01T00:00:00Z",
};

function fixture(error: object | null = null) {
  const upsert = jest.fn().mockResolvedValue({ error });
  const from = jest.fn().mockReturnValue({ upsert });
  return { client: { from } as unknown as SupabaseClient, from, upsert };
}

it("uses insert-only conflict handling for concurrent login and landing initializers", async () => {
  const { client, from, upsert } = fixture();
  await Promise.all([ensureUserProfile(client, user), ensureUserProfile(client, user)]);
  expect(from).toHaveBeenCalledWith("user_profiles");
  for (const [row, options] of upsert.mock.calls) {
    expect(row).toEqual({ uid: user.id, email: user.email, display_name: "Builder Name", created_at: user.created_at });
    expect(options).toEqual({ onConflict: "uid", ignoreDuplicates: true });
  }
});

it("initializes a password user's name from email when provider metadata is absent", async () => {
  const { client, upsert } = fixture();
  await ensureUserProfile(client, { ...user, user_metadata: {} });
  expect(upsert.mock.calls[0][0].display_name).toBe("builder");
});

it("returns database errors to the caller", async () => {
  const error = { message: "Profile unavailable", code: "42501" };
  const { client } = fixture(error);
  expect(await ensureUserProfile(client, user)).toBe(error);
});
