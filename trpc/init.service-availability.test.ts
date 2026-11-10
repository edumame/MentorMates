/** @jest-environment node */
import { TRPCError } from "@trpc/server";
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn(), createSupabaseServiceClient: jest.fn() }));
jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));
import { baseProcedure, createCallerFactory, createTRPCRouter } from "./init";
import { StreamNotConfiguredError } from "@/lib/stream-config";

const router = createTRPCRouter({
  video: baseProcedure.query(() => { throw new StreamNotConfiguredError("video"); }),
  other: baseProcedure.query(() => { throw new Error("boom"); }),
  ok: baseProcedure.query(() => "fine"),
});
const caller = createCallerFactory(router)({ userId: "u" });

it("maps an unconfigured Stream provider to PRECONDITION_FAILED", async () => {
  await expect(caller.video()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Video calls are not configured" });
});

it("leaves other errors and successes untouched", async () => {
  const error = await caller.other().catch((e: unknown) => e);
  expect(error).toBeInstanceOf(TRPCError);
  expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
  await expect(caller.ok()).resolves.toBe("fine");
});
