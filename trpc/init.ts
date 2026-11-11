import {
  createSupabaseClient,
  createSupabaseServiceClient,
} from '@/app/utils/supabase/server';
import { initTRPC, TRPCError } from '@trpc/server';
import type { User } from '@supabase/supabase-js';
import { cache } from 'react';
import { StreamNotConfiguredError } from '@/lib/stream-config';

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
/**
 * Optional providers (Stream video/chat) that are not configured surface as a
 * typed PRECONDITION_FAILED instead of an opaque 500, so views can render an
 * "unavailable" state.
 */
export const serviceAvailability = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof StreamNotConfiguredError) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: result.error.cause.message,
      cause: result.error.cause,
    });
  }
  return result;
});
export const baseProcedure = t.procedure.use(serviceAvailability);
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
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
