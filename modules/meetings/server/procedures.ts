import { meetingsInsertSchema, meetingsUpdateSchema } from "../schemas";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/config/constants";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import z from "zod";
import JSONL from "jsonl-parse-stringify";
import { MeetingStatus, StreamTranscriptItem } from "../types";
import { streamVideo } from "@/lib/stream-video";

export const meetingsRouter = createTRPCRouter({
    create: protectedProcedure.input(meetingsInsertSchema).mutation(async ({ input, ctx }) => {
        const supabase = ctx.supabase;
        const { data: createdRows, error: insertError } = await supabase.from('meetings')
            .insert({
                name: input.name,
                agent_id: input.agentId,
                user_id: ctx.auth.user.id
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
                image: ctx.auth.user.user_metadata?.avatar_url,
            },
        ]);
    
        return createdMeeting;
    }),
    getOne: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
        const supabase = ctx.supabase;
        const { data: meetingRows, error: meetingError } = await supabase.from('meetings').select('*');
        if (meetingError) throw meetingError;
        const existingMeeting = meetingRows?.[0];
        if (!existingMeeting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });

        const { data: agentRows, error: agentError } = await supabase.from('agents').select('*').eq('id', existingMeeting.agent_id).limit(1);
        if (agentError) throw agentError;
        const agent = agentRows?.[0] ?? null;

        // compute duration in seconds if timestamps exist
        let duration: number | null = null;
        if (existingMeeting.started_at && existingMeeting.ended_at) {
            const s = new Date(existingMeeting.started_at).getTime();
            const e = new Date(existingMeeting.ended_at).getTime();
            if (!Number.isNaN(s) && !Number.isNaN(e)) duration = Math.max(0, Math.floor((e - s) / 1000));
        }

        return { ...existingMeeting, agent, duration };
    }),
    getMany: protectedProcedure.input(z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z.number().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
        agentId: z.string().nullish(),
        status: z.enum([
            MeetingStatus.Upcoming,
            MeetingStatus.Active,
            MeetingStatus.Completed,
            MeetingStatus.Processing,
            MeetingStatus.Cancelled,
        ]).nullish(),
    })).query(async ({ ctx, input }) => {
        const { search, page, pageSize, status, agentId } = input;

        const supabase = ctx.supabase;
        // build base query
        let query = supabase.from('meetings').select('*', { count: 'exact' }).eq('user_id', ctx.auth.user.id);
        if (search) query = query.ilike('name', `%${search}%`);
        if (status) query = query.eq('status', status);
        if (agentId) query = query.eq('agent_id', agentId);

        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;
        const { data: items, error: listError, count } = await query.range(start, end);
        if (listError) throw listError;

        // fetch agent details in bulk
        const agentIds = Array.from(new Set((items || []).map((it: any) => it.agent_id).filter(Boolean)));
        let agentsById: Record<string, any> = {};
        if (agentIds.length) {
            const { data: agentRows } = await supabase.from('agents').select('*').in('id', agentIds);
            agentsById = (agentRows || []).reduce((acc: any, a: any) => { acc[a.id] = a; return acc; }, {} as any);
        }

        const itemsWithExtras = (items || []).map((it: any) => {
            let duration: number | null = null;
            if (it.started_at && it.ended_at) {
                const s = new Date(it.started_at).getTime();
                const e = new Date(it.ended_at).getTime();
                if (!Number.isNaN(s) && !Number.isNaN(e)) duration = Math.max(0, Math.floor((e - s) / 1000));
            }
            return { ...it, agent: agentsById[it.agent_id] ?? null, duration };
        });

        const total = count ?? 0;
        const totalPages = Math.ceil(total / pageSize);

        return { items: itemsWithExtras, total, totalPages };
    }),
    update: protectedProcedure.input(meetingsUpdateSchema).mutation(async ({ ctx, input }) => {
        const supabase = ctx.supabase;
        const { data, error } = await supabase.from('meetings').update(input).match({ id: input.id, user_id: ctx.auth.user.id }).select();
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
        const { data: meetingRows, error: meetingError } = await supabase.from('meetings').select('*').eq('id', input.id).eq('user_id', ctx.auth.user.id).limit(1);
        if (meetingError) throw meetingError;
        const existingMeeting = meetingRows?.[0];
        if (!existingMeeting) throw new TRPCError({ code: 'NOT_FOUND', message: 'meeting not found' });

        if (!existingMeeting.transcriptUrl) {
            return [];
        }

        const transcript = await fetch(existingMeeting.transcriptUrl)
            .then((res) => res.text())
            .then((text) => JSONL.parse<StreamTranscriptItem>(text))
            .catch(() => {
                return [];
            });

        const speakerIds = [...new Set(transcript.map((item) => item.speaker_id))];

        const { data: userSpeakersRows } = await supabase.from('user').select('*').in('id', speakerIds);
        const userSpeakers = (userSpeakersRows || []).map((u: any) => ({ ...u, image: u.image }));

        const { data: agentSpeakersRows } = await supabase.from('agents').select('*').in('id', speakerIds);
        const agentSpeakers = (agentSpeakersRows || []).map((a: any) => ({ ...a, image: a.image }));

        const speakers = [...userSpeakers, ...agentSpeakers];

        const transcriptWithSpeakers = transcript.map((item) => {
            const speaker = speakers.find((speaker) => speaker.id === item.speaker_id);

            if (!speaker) {
                return {
                    ...item,
                    user: {
                        name: "Unknown",
                        image: "Unknown",
                    },
                }
            }

            return {
                ...item,
                user: {
                    name: speaker.name,
                    image: speaker.image,
                },
            };
        });

        return transcriptWithSpeakers;
    }),
});