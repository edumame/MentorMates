import {
  createSupabaseClient,
  createSupabaseServiceClient,
} from '@/app/utils/supabase/server';
import { initTRPC, TRPCError } from '@trpc/server';
import type { User } from '@supabase/supabase-js';
import { cache } from 'react';

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: 'user_123' };
});
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  // transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const supabase = await createSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!authError && user) {
    return next({ ctx: { ...ctx, auth: { user }, supabase } });
  }

  const isDevBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const bypassUserId =
    process.env.DEV_AUTH_BYPASS_USER_ID ||
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_USER_ID;

  if (isDevBypassEnabled && bypassUserId) {
    const serviceSupabase = await createSupabaseServiceClient();
    const bypassUser = { id: bypassUserId } as User;

    return next({
      ctx: {
        ...ctx,
        auth: { user: bypassUser, isDevBypass: true },
        supabase: serviceSupabase,
      },
    });
  }

  throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
});
