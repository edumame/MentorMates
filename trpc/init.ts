import { createSupabaseClient } from '@/app/utils/supabase/server';
import { initTRPC, TRPCError } from '@trpc/server';

export const createTRPCContext = async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: 'user_123' };
};
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  return next({ ctx: { ...ctx, auth: { user }, supabase } });
});