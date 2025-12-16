import { agentsInsertSchema, agentsUpdateSchema } from "@/modules/agents/schemas";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/config/constants";
import { supabase } from "@/lib/supabase";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const agentsRouter = createTRPCRouter({
    getOne: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
        const { data: agentRows, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', input.id)
            .eq('user_id', ctx.auth.user.id)
            .limit(1);

        if (agentError) throw agentError;
        const existingAgent = agentRows?.[0];
        if (!existingAgent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });

        const { count: meetingCount } = await supabase
            .from('meetings')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', existingAgent.id);

        return { ...existingAgent, meetingCount: meetingCount ?? 0 };
    }),

    getMany: protectedProcedure.input(z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z.number().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish()
    })).query(async ({ ctx, input }) => {
        const { search, page, pageSize } = input;

        const query = supabase.from('agents').select('*', { count: 'exact' }).eq('user_id', ctx.auth.user.id);
        if (search) query.ilike('name', `%${search}%`);
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;
        const { data: items, error: listError, count } = await query.range(start, end);
        if (listError) throw listError;

        const itemsWithCounts = await Promise.all((items || []).map(async (a: any) => {
            const { count: c } = await supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('agent_id', a.id);
            return { ...a, meetingCount: c ?? 0 };
        }));

        const total = count ?? 0;
        const totalPages = Math.ceil(total / pageSize);

        return { items: itemsWithCounts, total, totalPages };
    }),

    remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const { data, error } = await supabase.from('agents').delete().match({ id: input.id, user_id: ctx.auth.user.id }).select();
        if (error) throw error;
        const removedAgent = data?.[0];
        if (!removedAgent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
        return removedAgent;
    }),

    update: protectedProcedure.input(agentsUpdateSchema).mutation(async ({ ctx, input }) => {
        const { data, error } = await supabase.from('agents').update(input).match({ id: input.id, user_id: ctx.auth.user.id }).select();
        if (error) throw error;
        const updatedAgent = data?.[0];
        if (!updatedAgent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
        return updatedAgent;
    }),
});