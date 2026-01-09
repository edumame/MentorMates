import { meetingsInsertSchema, meetingsUpdateSchema } from "../schemas";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/config/constants";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { MAX_SESSIONS } from "@/trpc/constants";
import { TRPCError } from "@trpc/server";
import z from "zod";
import JSONL from "jsonl-parse-stringify";
import { MeetingStatus, StreamTranscriptItem } from "../types";
import { streamVideo } from "@/lib/stream-video";

interface MeetingRow {
  id: string;
  name?: string | null;
  status?: MeetingStatus | null;
  agent_id?: string | null;
  event_id?: string | null;
  project_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  transcript_url?: string | null;
  [key: string]: unknown;
}

interface Speaker {
    id?: string | null;
    name?: string | null;
    display_name?: string | null;
    image?: string | null;
    [key: string]: unknown;
}

interface SessionCaps {
    default: number | null;
    agent_caps: Record<string, number | null>;
}

type AgentRow = { id: string; name?: string | null; avatar_url?: string | null };
type UserProfileRow = Record<string, unknown>;

export const meetingsRouter = createTRPCRouter({
    create: protectedProcedure.input(meetingsInsertSchema).mutation(async ({ input, ctx }) => {
        const supabase = ctx.supabase;
        try {
            const agentId = input.agentId || null;
            const eventId = input.eventId || null;

            // Check if user is admin - admins bypass all session caps
            const { data: isAdmin } = await supabase.rpc('is_admin_user', {
                user_id: ctx.auth.user.id
            });

            // Admin users bypass all session caps
            if (!isAdmin) {
                if (eventId) {
                    const { data: eventRow, error: eventErr } = await supabase
                        .from('events')
                        .select('session_caps')
                        .eq('event_id', eventId)
                        .limit(1)
                        .maybeSingle();

                    if (eventErr) {
                        throw eventErr;
                    }

                    const sessionCaps = (eventRow as { session_caps?: SessionCaps | null } | null)?.session_caps ?? null;

                    if (sessionCaps) {
                        const agentCaps = (sessionCaps.agent_caps || {}) as Record<string, number | null>;
                        const configuredAgentCap = agentId ? agentCaps[agentId] ?? null : null;

                        if (configuredAgentCap !== null && configuredAgentCap !== undefined) {
                            const { count, error } = await supabase
                                .from('meetings')
                                .select('id', { count: 'exact', head: true })
                                .eq('user_id', ctx.auth.user.id)
                                .eq('event_id', eventId)
                                .eq('agent_id', agentId);

                            if (error) throw error;

                            const userMeetingsCount = typeof count === 'number' ? count : 0;
                            if (userMeetingsCount >= configuredAgentCap) {
                                throw new TRPCError({ code: 'FORBIDDEN', message: `You have reached the maximum number of sessions for this agent (${userMeetingsCount}/${configuredAgentCap})` });
                            }
                        } else {
                            const defaultCap = sessionCaps.default;
                            if (defaultCap !== null && defaultCap !== undefined) {
                                const { count, error } = await supabase
                                    .from('meetings')
                                    .select('id', { count: 'exact', head: true })
                                    .eq('user_id', ctx.auth.user.id)
                                    .eq('event_id', eventId);

                                if (error) throw error;

                                const userMeetingsCountForEvent = typeof count === 'number' ? count : 0;
                                if (userMeetingsCountForEvent >= Number(defaultCap)) {
                                    throw new TRPCError({ code: 'FORBIDDEN', message: `You have reached the maximum number of sessions for this event (${userMeetingsCountForEvent}/${Number(defaultCap)})` });
                                }
                            }
                        }
                    }
                } else {
                    // No event provided — use default global MAX_SESSIONS
                    const { data: rows, count, error } = await supabase
                        .from('meetings')
                        .select('id', { count: 'exact' })
                        .eq('user_id', ctx.auth.user.id);

                    if (error) throw error;

                    const userMeetingsCount = typeof count === 'number' ? count : (rows?.length ?? 0);
                    if (userMeetingsCount >= MAX_SESSIONS) {
                        throw new TRPCError({ code: 'FORBIDDEN', message: `You have reached the maximum number of sessions (${userMeetingsCount}/${MAX_SESSIONS})` });
                    }
                }
            }
        } catch (err) {
            if (err instanceof TRPCError) throw err;
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: (err as Error).message || 'Failed to enforce session caps' });
        }

        const { data: createdRows, error: insertError } = await supabase.from('meetings')
            .insert({
                name: input.name,
                agent_id: input.agentId,
                user_id: ctx.auth.user.id,
                event_id: input.eventId || null,
                project_id: input.projectId || null,
            }).select().limit(1);

        if (insertError) throw insertError;
        const createdMeeting = createdRows?.[0];

        const call = streamVideo.video.call("default", createdMeeting.id);
        await call.create({
            data: {
                created_by_id: ctx.auth.user.id,
                custom: {
                    meetingId: createdMeeting.id,
                    meetingName: createdMeeting.name
                },
                settings_override: {
                    transcription: {
                        language: "en",
                        mode: "auto-on",
                        closed_caption_mode: "auto-on",
                    },
                    recording: {
                        mode: "auto-on",
                        quality: "1080p",
                    },
                },
            },
        });

        const { data: agentRows, error: agentError } = await supabase.from('agents').select('*').eq('id', createdMeeting.agent_id).limit(1);
        const existingAgent = agentRows?.[0];
        if (agentError) throw agentError;
        if (!existingAgent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });

        await streamVideo.upsertUsers([
            {
                id: existingAgent.id,
                name: existingAgent.name,
                role: "user",
                image: existingAgent.avatar_url,
            },
        ]);
    
        return createdMeeting;
    }),
    getOne: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
        const supabase = ctx.supabase;
        const { data: meetingRows, error: meetingError } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', input.id)
            .eq('user_id', ctx.auth.user.id)
            .limit(1);

        if (meetingError) throw meetingError;
        const existingMeeting = meetingRows?.[0];
        if (!existingMeeting) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
        }

        let duration: number | null = null;
        if (existingMeeting.started_at && existingMeeting.ended_at) {
            const s = new Date(existingMeeting.started_at).getTime();
            const e = new Date(existingMeeting.ended_at).getTime();
            if (!Number.isNaN(s) && !Number.isNaN(e)) duration = Math.max(0, Math.floor((e - s) / 1000));
        }

        const { data: agentRows, error: agentError } = await supabase.from('agents').select('*').eq('id', existingMeeting.agent_id).limit(1);
        if (agentError) throw agentError;
        const agent = agentRows?.[0] ?? null;

        return { ...existingMeeting, agent, duration };
    }),
    getMany: protectedProcedure.input(z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z.number().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
        agentId: z.string().nullish(),
        eventId: z.string().nullish(),
        projectId: z.string().nullish(),
        status: z.enum([
            MeetingStatus.Upcoming,
            MeetingStatus.Active,
            MeetingStatus.Completed,
            MeetingStatus.Processing,
            MeetingStatus.Cancelled,
        ]).nullish(),
    })).query(async ({ ctx, input }) => {
        const { search, page, pageSize, status, agentId, eventId, projectId } = input;
        const supabase = ctx.supabase;

        // Build the base filters
        const offset = (page - 1) * pageSize;

        // Fetch paginated meetings
        let meetingsQuery = supabase
            .from("meetings")
            .select("*")
            .eq("user_id", ctx.auth.user.id);

        if (search) meetingsQuery = meetingsQuery.ilike("name", `%${search}%`);
        if (status) meetingsQuery = meetingsQuery.eq("status", status);
        if (agentId) meetingsQuery = meetingsQuery.eq("agent_id", agentId);
        if (eventId) meetingsQuery = meetingsQuery.eq("event_id", eventId);
        if (projectId) meetingsQuery = meetingsQuery.eq("project_id", projectId);

        const { data: items = [], error: itemsError } = await meetingsQuery
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (itemsError) throw itemsError;

        // Fetch total count (exact)
        let countQuery = supabase
            .from("meetings")
            .select("id", { count: "exact", head: false })
            .eq("user_id", ctx.auth.user.id);

        if (search) countQuery = countQuery.ilike("name", `%${search}%`);
        if (status) countQuery = countQuery.eq("status", status);
        if (agentId) countQuery = countQuery.eq("agent_id", agentId);
        if (eventId) countQuery = countQuery.eq("event_id", eventId);
        if (projectId) countQuery = countQuery.eq("project_id", projectId);

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        const total = count ?? 0;
        const totalPages = Math.ceil(total / pageSize);

        // Hydrate agents for the fetched items
        const agentIds = Array.from(new Set((items || []).map((m: MeetingRow) => (m.agent_id as string | undefined)).filter(Boolean)));
        let agentsMap: Record<string, AgentRow> = {};
        if (agentIds.length > 0) {
            const { data: agentRows = [], error: agentErr } = await supabase.from("agents").select("*").in("id", agentIds);
            if (agentErr) throw agentErr;
            agentsMap = (agentRows || []).reduce((acc: Record<string, AgentRow>, a: Record<string, unknown>) => {
                const id = String(a.id);
                acc[id] = {
                    id,
                    name: (a.name as string | undefined) ?? null,
                    avatar_url: (a.avatar_url as string | undefined) ?? null,
                };
                return acc;
            }, {});
        }

        // Compute duration and attach agent
        const hydrated = (items || []).map((m: MeetingRow) => {
            let duration: number | null = null;
            const startedAt = m.started_at as string | undefined;
            const endedAt = m.ended_at as string | undefined;
            if (startedAt && endedAt) {
                const s = new Date(startedAt).getTime();
                const e = new Date(endedAt).getTime();
                if (!Number.isNaN(s) && !Number.isNaN(e)) duration = Math.max(0, Math.floor((e - s) / 1000));
            }

            const agentId = m.agent_id as string | undefined;

            return {
                ...(m as MeetingRow),
                agent: agentId ? agentsMap[agentId] ?? null : null,
                duration,
            };
        });

        return {
            items: hydrated,
            total,
            totalPages,
        };
    }),
    update: protectedProcedure.input(meetingsUpdateSchema).mutation(async ({ ctx, input }) => {
        const supabase = ctx.supabase;
        const { agentId, eventId, projectId, id, ...rest } = input;
        const updatePayload: Record<string, string | null> = {
            ...rest,
            agent_id: agentId,
            event_id: eventId || null,
            project_id: projectId || null,
        };
        const { data, error } = await supabase.from('meetings').update(updatePayload).match({ id, user_id: ctx.auth.user.id }).select();
        if (error) throw error;
        const updatedMeeting = data?.[0];
        if (!updatedMeeting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
        return updatedMeeting;
    }),
    remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const supabase = ctx.supabase;
        const { data, error } = await supabase.from('meetings').delete().match({ id: input.id, user_id: ctx.auth.user.id }).select();
        if (error) throw error;
        const removedMeeting = data?.[0];
        if (!removedMeeting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
        return removedMeeting;
    }),
    generateToken: protectedProcedure.mutation(async ({ ctx }) => {
        await streamVideo.upsertUsers([
            {
                id: ctx.auth.user.id,
                name: ctx.auth.user.user_metadata.full_name,
                role: "admin",
                image: ctx.auth.user.user_metadata?.avatar_url,
            },
        ]);

        const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const issuedAt = Math.floor(Date.now() / 1000) - 60;

        const token = streamVideo.generateUserToken({
            user_id: ctx.auth.user.id,
            exp: expirationTime,
            validity_in_seconds: issuedAt,
        });

        return token;
    }),
    getTranscript: protectedProcedure.input(z.object({ id: z.string()} )).query(async ({ input, ctx }) => {
        const supabase = ctx.supabase;

        const { data: existingMeeting, error: meetingError } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', input.id)
            .eq('user_id', ctx.auth.user.id)
            .maybeSingle();

        if (meetingError) throw meetingError;
        if (!existingMeeting) {
            throw new TRPCError({ code: "NOT_FOUND", message: "meeting not found" });
        }

        if (!existingMeeting.transcript_url) {
            return [];
        }

        const transcript = await fetch(existingMeeting.transcript_url)
            .then((res) => res.text())
            .then((text) => JSONL.parse<StreamTranscriptItem>(text))
            .catch(() => {
                return [];
            });

        const speakerIds = [...new Set(transcript.map((item) => item.speaker_id))];

        const { data: userSpeakersRows = [] } = await supabase.from('user_profiles').select('*').in('uid', speakerIds);
        const userSpeakers: Speaker[] = (userSpeakersRows || []).map((u: UserProfileRow) => ({ ...(u as Record<string, unknown>), image: (u.image as string | undefined) ?? null, id: (u.uid as string | undefined) ?? null }));

        const { data: agentSpeakersRows = [] } = await supabase.from('agents').select('*').in('id', speakerIds);
        const agentSpeakers: Speaker[] = (agentSpeakersRows || []).map((a: Record<string, unknown>) => ({ ...(a as Record<string, unknown>), image: (a.avatar_url as string | undefined) ?? null, id: (a.id as string | undefined) ?? null }));

        const speakers: Speaker[] = [...userSpeakers, ...agentSpeakers];

        const transcriptWithSpeakers = transcript.map((item) => {
            const speaker = speakers.find((speaker) => speaker.id === item.speaker_id);

            if (!speaker) {
                return {
                    ...item,
                    user: {
                        name: "Unknown",
                        image: "",
                    },
                }
            }

            return {
                ...item,
                user: {
                    name: speaker.name ?? speaker.display_name,
                    image: speaker.image ?? ctx.auth.user.user_metadata?.avatar_url,
                },
            };
        });

        return transcriptWithSpeakers;
    }),
});