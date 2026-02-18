import { agentsInsertSchema, agentsUpdateSchema } from "@/modules/agents/schemas";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/config/constants";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import z from "zod";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

const EDITOR_EVENT_ROLES = ["organizer", "admin"] as const;
type EditorEventRole = (typeof EDITOR_EVENT_ROLES)[number];

type AgentPermissionRow = {
    id: string;
    user_id?: string | null;
    event_id?: string | null;
    updated_at?: string | null;
    [key: string]: unknown;
};

type UserEventRoleRow = {
    event_id?: string | null;
    role?: string | null;
};

type EventOwnerRow = {
    event_id?: string | null;
    owner_id?: string | null;
};

interface AgentAccessContext {
    isAdmin: boolean;
    editorEventIds: Set<string>;
    ownerEventIds: Set<string>;
}

function normalizeId(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim();
}

function toIdSet(values: unknown[]): Set<string> {
    return new Set(values.map(normalizeId).filter(Boolean));
}

async function getIsAdmin(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.rpc("is_admin_user", { user_id: userId });
    if (error) throw error;
    return Boolean(data);
}

async function getUserEventRoles(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from("user_event_roles").select("event_id, role").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []) as UserEventRoleRow[];
}

async function getOwnerEventIds(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from("events").select("event_id").eq("owner_id", userId);
    if (error) throw error;
    return toIdSet(((data ?? []) as EventOwnerRow[]).map((row) => row.event_id));
}

function canManageEvent(eventId: string, access: AgentAccessContext): boolean {
    if (!eventId) return false;
    return access.isAdmin || access.editorEventIds.has(eventId) || access.ownerEventIds.has(eventId);
}

function canEditAgent(agent: AgentPermissionRow, userId: string, access: AgentAccessContext): boolean {
    const ownerId = normalizeId(agent.user_id);
    if (ownerId === userId) return true;
    if (access.isAdmin) return true;
    const eventId = normalizeId(agent.event_id);
    if (!eventId) return false;
    return canManageEvent(eventId, access);
}

async function userCanManageEventAgents(supabase: SupabaseClient, userId: string, eventId: string): Promise<boolean> {
    const isAdmin = await getIsAdmin(supabase, userId);
    if (isAdmin) return true;

    const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select("owner_id")
        .eq("event_id", eventId)
        .maybeSingle();
    if (eventError) throw eventError;
    if (normalizeId(eventRow?.owner_id) === userId) return true;

    const { data: roleRow, error: roleError } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .in("role", [...EDITOR_EVENT_ROLES])
        .maybeSingle();
    if (roleError) throw roleError;

    return Boolean(roleRow?.role);
}

async function userCanEditAgent(supabase: SupabaseClient, userId: string, agent: AgentPermissionRow): Promise<boolean> {
    const ownerId = normalizeId(agent.user_id);
    if (ownerId === userId) return true;

    const eventId = normalizeId(agent.event_id);
    if (!eventId) {
        return getIsAdmin(supabase, userId);
    }

    return userCanManageEventAgents(supabase, userId, eventId);
}

export const agentsRouter = createTRPCRouter({
    getOne: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
        const supabase = ctx.supabase;
        const userId = ctx.auth.user.id;

        const { data: agent, error: agentError } = await supabase.from("agents").select("*").eq("id", input.id).maybeSingle();
        if (agentError) throw agentError;
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });

        const [isAdmin, userEventRoles, ownerEventIds] = await Promise.all([
            getIsAdmin(supabase, userId),
            getUserEventRoles(supabase, userId),
            getOwnerEventIds(supabase, userId),
        ]);

        const memberEventIds = toIdSet(userEventRoles.map((r) => r.event_id));
        const editorEventIds = toIdSet(
            userEventRoles
                .filter((r) => EDITOR_EVENT_ROLES.includes(normalizeId(r.role) as EditorEventRole))
                .map((r) => r.event_id)
        );
        const access: AgentAccessContext = { isAdmin, editorEventIds, ownerEventIds };

        const agentEventId = normalizeId(agent.event_id);
        const ownerId = normalizeId(agent.user_id);
        const canViewEventAgent = isAdmin || ownerEventIds.has(agentEventId) || memberEventIds.has(agentEventId);
        if (ownerId !== userId && agentEventId && !canViewEventAgent) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to view this agent" });
        }

        const { count: meetingCount } = await supabase
            .from("meetings")
            .select("id", { count: "exact", head: false })
            .eq("agent_id", agent.id)
            .then((r) => ({ count: r.count ?? 0 }));

        return { ...agent, meetingCount, can_edit: canEditAgent(agent as AgentPermissionRow, userId, access) };
    }),

    getMany: protectedProcedure
        .input(
            z.object({
                page: z.number().default(DEFAULT_PAGE),
                pageSize: z.number().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
                search: z.string().nullish(),
                eventId: z.string().nullish(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, eventId } = input;
            const supabase = ctx.supabase;
            const userId = ctx.auth.user.id;

            const offset = (page - 1) * pageSize;

            const [isAdmin, userEventRoles, ownerEventIds] = await Promise.all([
                getIsAdmin(supabase, userId),
                getUserEventRoles(supabase, userId),
                getOwnerEventIds(supabase, userId),
            ]);

            const memberEventIds = toIdSet(userEventRoles.map((r) => r.event_id));
            const accessibleEventIds = Array.from(new Set([...memberEventIds, ...ownerEventIds]));
            const editorEventIds = toIdSet(
                userEventRoles
                    .filter((r) => EDITOR_EVENT_ROLES.includes(normalizeId(r.role) as EditorEventRole))
                    .map((r) => r.event_id)
            );

            if (eventId) {
                const canViewEvent = isAdmin || ownerEventIds.has(eventId) || memberEventIds.has(eventId);
                if (!canViewEvent) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to view agents for this event" });
                }
            }

            // Build query to get:
            // 1. Agents owned by the user (user_id = current user)
            // 2. Agents for events the user has access to (event_id in user's events)
            let agentsQuery = supabase.from("agents").select("*");

            if (eventId) {
                // If specific event requested, only show agents for that event
                agentsQuery = agentsQuery.eq("event_id", eventId);
            } else if (accessibleEventIds.length > 0) {
                // Show user's own agents OR agents from events they have access to OR global agents (no event_id)
                agentsQuery = agentsQuery.or(
                    `user_id.eq.${userId},event_id.in.(${accessibleEventIds.join(",")}),event_id.is.null`
                );
            } else {
                // No event access, show user's own agents or global agents
                agentsQuery = agentsQuery.or(`user_id.eq.${userId},event_id.is.null`);
            }

            if (search) agentsQuery = agentsQuery.ilike("name", `%${search}%`);

            const { data: items = [], error: itemsError } = await agentsQuery
                .order("created_at", { ascending: false })
                .order("id", { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (itemsError) throw itemsError;

            // total count - use same filter logic as main query
            let countQuery = supabase.from("agents").select("id", { count: "exact", head: false });
            if (eventId) {
                countQuery = countQuery.eq("event_id", eventId);
            } else if (accessibleEventIds.length > 0) {
                countQuery = countQuery.or(
                    `user_id.eq.${userId},event_id.in.(${accessibleEventIds.join(",")}),event_id.is.null`
                );
            } else {
                countQuery = countQuery.or(`user_id.eq.${userId},event_id.is.null`);
            }
            if (search) countQuery = countQuery.ilike("name", `%${search}%`);
            const { count, error: countError } = await countQuery;
            if (countError) throw countError;
            const total = count ?? 0;
            const totalPages = Math.ceil(total / pageSize);

            // meeting counts per agent
            const agentIds = Array.from(new Set((items || []).map((a: unknown) => normalizeId((a as { id?: string }).id)).filter(Boolean)));
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

            const access: AgentAccessContext = { isAdmin, editorEventIds, ownerEventIds };
            const itemsWithCounts = (items || []).map((a: unknown) => {
                const row = a as AgentPermissionRow;
                const id = normalizeId(row.id);
                return {
                    ...(row as Record<string, unknown>),
                    meetingCount: meetingCountsMap[id] ?? 0,
                    can_edit: canEditAgent(row, userId, access),
                };
            });

            return {
                items: itemsWithCounts,
                total,
                totalPages,
            };
        }),

    create: protectedProcedure.input(agentsInsertSchema).mutation(async ({ input, ctx }) => {
        const supabase = ctx.supabase;
        if (input.event_id) {
            const canManage = await userCanManageEventAgents(supabase, ctx.auth.user.id, input.event_id);
            if (!canManage) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You don't have permission to create agents for this event.",
                });
            }
        }

        const payloadBase = { ...input, user_id: ctx.auth.user.id };
        const dbPayload: Record<string, unknown> = { ...payloadBase };
        // strip undefined fields to avoid accidental updates
        Object.keys(dbPayload).forEach((k) => (dbPayload[k] === undefined ? delete dbPayload[k] : null));

        const { data: createdRows, error } = await supabase.from("agents").insert(dbPayload).select();
        if (error) throw error;
        const createdAgent = createdRows?.[0];

        return createdAgent;
    }),

    remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const supabase = ctx.supabase;
        const { data: existingAgent, error: existingError } = await supabase
            .from("agents")
            .select("id, user_id, event_id")
            .eq("id", input.id)
            .maybeSingle();
        if (existingError) throw existingError;
        if (!existingAgent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });

        const canEdit = await userCanEditAgent(supabase, ctx.auth.user.id, existingAgent as AgentPermissionRow);
        if (!canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this agent." });

        const { data, error } = await supabase.from("agents").delete().eq("id", input.id).select();
        if (error) throw error;
        const removedAgent = data?.[0];
        if (!removedAgent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found or already removed" });
        return removedAgent;
    }),

    update: protectedProcedure.input(agentsUpdateSchema).mutation(async ({ ctx, input }) => {
        const supabase = ctx.supabase;
        const { data: existingAgent, error: existingError } = await supabase
            .from("agents")
            .select("id, user_id, event_id, updated_at")
            .eq("id", input.id)
            .maybeSingle();
        if (existingError) throw existingError;
        if (!existingAgent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });

        const canEdit = await userCanEditAgent(supabase, ctx.auth.user.id, existingAgent as AgentPermissionRow);
        if (!canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to update this agent." });

        const expectedUpdatedAt = normalizeId(input.expected_updated_at);
        const currentUpdatedAt = normalizeId((existingAgent as AgentPermissionRow).updated_at);
        if (expectedUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
            throw new TRPCError({
                code: "CONFLICT",
                message: "This agent was updated by someone else. Reload the page and try again.",
            });
        }

        const updateBase = { ...input } as Record<string, unknown>;
        // remove id from payload
        delete updateBase.id;
        delete updateBase.expected_updated_at;
        // remove undefined fields so we don't overwrite columns unintentionally
        Object.keys(updateBase).forEach((k) => (updateBase[k] === undefined ? delete updateBase[k] : null));
        updateBase.updated_at = new Date().toISOString();

        let updateQuery = supabase.from("agents").update(updateBase).eq("id", input.id);
        if (expectedUpdatedAt) {
            updateQuery = updateQuery.eq("updated_at", expectedUpdatedAt);
        }

        const { data, error } = await updateQuery.select();
        if (error) throw error;

        const updatedAgent = data?.[0];
        if (!updatedAgent && expectedUpdatedAt) {
            throw new TRPCError({
                code: "CONFLICT",
                message: "This agent was updated by someone else. Reload the page and try again.",
            });
        }
        if (!updatedAgent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        return updatedAgent;
    }),

    updateEventSessionCaps: protectedProcedure
        .input(
            z.object({
                eventId: z.string().min(1, { message: "eventId is required" }),
                sessionCaps: z.record(z.unknown()),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const supabase = ctx.supabase;
            const userId = ctx.auth.user.id;

            const canEdit = await userCanManageEventAgents(supabase, userId, input.eventId);

            if (!canEdit) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You don't have permission to update session caps for this event.",
                });
            }

            const { error } = await supabase
                .from("events")
                .update({ session_caps: input.sessionCaps })
                .eq("event_id", input.eventId);

            if (error) throw error;

            return { ok: true };
        }),
});
