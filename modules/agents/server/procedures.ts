import { agentsInsertSchema, agentsUpdateSchema } from "@/modules/agents/schemas";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/config/constants";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const agentsRouter = createTRPCRouter({
    getOne: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
        const supabase = ctx.supabase;

        const { data: agent, error: agentError } = await supabase
            .from("agents")
            .select("*")
            .eq("id", input.id)
            .eq("user_id", ctx.auth.user.id)
            .maybeSingle();

        if (agentError) throw agentError;
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });

        const { count: meetingCount } = await supabase
            .from("meetings")
            .select("id", { count: "exact", head: false })
            .eq("agent_id", agent.id)
            .then((r) => ({ count: r.count ?? 0 }));

        return { ...agent, meetingCount };
    }),

    getMany: protectedProcedure
        .input(
            z.object({
                page: z.number().default(DEFAULT_PAGE),
                pageSize: z.number().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
                search: z.string().nullish(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize } = input;
            const supabase = ctx.supabase;

            const offset = (page - 1) * pageSize;

            let agentsQuery = supabase.from("agents").select("*").eq("user_id", ctx.auth.user.id);
            if (search) agentsQuery = agentsQuery.ilike("name", `%${search}%`);

            const { data: items = [], error: itemsError } = await agentsQuery
                .order("created_at", { ascending: false })
                .order("id", { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (itemsError) throw itemsError;

            // total count
            let countQuery = supabase.from("agents").select("id", { count: "exact", head: false }).eq("user_id", ctx.auth.user.id);
            if (search) countQuery = countQuery.ilike("name", `%${search}%`);
            const { count, error: countError } = await countQuery;
            if (countError) throw countError;
            const total = count ?? 0;
            const totalPages = Math.ceil(total / pageSize);

            // meeting counts per agent
            const agentIds = Array.from(new Set((items || []).map((a: unknown) => (a as { id?: string }).id).filter(Boolean)));
            let meetingCountsMap: Record<string, number> = {};
            if (agentIds.length > 0) {
                const { data: meetingsRows = [], error: meetingsErr } = await supabase
                    .from("meetings")
                    .select("agent_id")
                    .in("agent_id", agentIds);
                if (meetingsErr) throw meetingsErr;
                meetingCountsMap = (meetingsRows || []).reduce((acc: Record<string, number>, r: unknown) => {
                    const agentId = (r as { agent_id?: string }).agent_id;
                    if (agentId) acc[agentId] = (acc[agentId] || 0) + 1;
                    return acc;
                }, {});
            }

            const itemsWithCounts = (items || []).map((a: unknown) => {
                const id = (a as { id?: string }).id;
                return { ...(a as Record<string, unknown>), meetingCount: meetingCountsMap[id ?? ""] ?? 0 };
            });

            return {
                items: itemsWithCounts,
                total,
                totalPages,
            };
        }),

    create: protectedProcedure.input(agentsInsertSchema).mutation(async ({ input, ctx }) => {
        const supabase = ctx.supabase;
        const payloadBase = { ...input, user_id: ctx.auth.user.id };
        const dbPayload: Record<string, unknown> = { ...payloadBase };
        // normalize custom_type for non-custom types
        if ((dbPayload.type as string) !== "custom") dbPayload.custom_type = null;
        // strip undefined fields to avoid accidental updates
        Object.keys(dbPayload).forEach((k) => (dbPayload[k] === undefined ? delete dbPayload[k] : null));

        const { data: createdRows, error } = await supabase.from("agents").insert(dbPayload).select().limit(1);
        if (error) throw error;
        const createdAgent = createdRows?.[0];

        return createdAgent;
    }),

    remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const supabase = ctx.supabase;
        const { data, error } = await supabase.from("agents").delete().match({ id: input.id, user_id: ctx.auth.user.id }).select();
        if (error) throw error;
        const removedAgent = data?.[0];
        if (!removedAgent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        return removedAgent;
    }),

    update: protectedProcedure.input(agentsUpdateSchema).mutation(async ({ ctx, input }) => {
        const supabase = ctx.supabase;
        const updateBase = { ...input } as Record<string, unknown>;
        // remove id from payload and normalize custom_type for non-custom types
        delete updateBase.id;
        if ((updateBase.type as string) !== "custom") updateBase.custom_type = null;
        // remove undefined fields so we don't overwrite columns unintentionally
        Object.keys(updateBase).forEach((k) => (updateBase[k] === undefined ? delete updateBase[k] : null));

        const { data, error } = await supabase.from("agents").update(updateBase).match({ id: input.id, user_id: ctx.auth.user.id }).select();
        if (error) throw error;
        const updatedAgent = data?.[0];
        if (!updatedAgent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        return updatedAgent;
    }),
});