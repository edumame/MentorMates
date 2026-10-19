/** @jest-environment node */
import { createTRPCRouter, protectedProcedure } from "./init";
import { createSupabaseClient, createSupabaseServiceClient } from "@/app/utils/supabase/server";

// React server cache is unavailable under Jest's client export condition.
jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(), createSupabaseServiceClient: jest.fn(),
}));
const operation = jest.fn();
const router = createTRPCRouter({ guarded: protectedProcedure.mutation(({ ctx }) => {
  operation(ctx.auth.user.id);
  return ctx.auth.user.id;
}) });
const user = { id: "11111111-1111-4111-8111-111111111111" };
const getUser = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_DEV_AUTH_BYPASS: "false" });
  jest.mocked(createSupabaseClient).mockResolvedValue({ auth: { getUser } } as never);
});
afterEach(() => jest.restoreAllMocks());
it("allows verified authentication through the actual middleware", async () => {
  getUser.mockResolvedValue({ data: { user }, error: null });
  await expect(router.createCaller({}).guarded()).resolves.toBe(user.id);
  expect(operation).toHaveBeenCalledWith(user.id);
});
it.each([null, user])("rejects authentication errors even when a user is returned (%p)", async value => {
  getUser.mockResolvedValue({ data: { user: value }, error: new Error("Verification failed") });
  await expect(router.createCaller({}).guarded()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(operation).not.toHaveBeenCalled();
  expect(createSupabaseServiceClient).not.toHaveBeenCalled();
});
it("rejects absent identity and ignores development bypass flags in production", async () => {
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = "true";
  process.env.DEV_AUTH_BYPASS_USER_ID = user.id;
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(router.createCaller({}).guarded()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(operation).not.toHaveBeenCalled();
  expect(createSupabaseServiceClient).not.toHaveBeenCalled();
});

it("preserves the explicitly configured non-production development bypass", async () => {
  jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "development", NEXT_PUBLIC_DEV_AUTH_BYPASS: "true", DEV_AUTH_BYPASS_USER_ID: user.id });
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  jest.mocked(createSupabaseServiceClient).mockResolvedValue({} as never);
  await expect(router.createCaller({}).guarded()).resolves.toBe(user.id);
  expect(createSupabaseServiceClient).toHaveBeenCalledTimes(1);
});
