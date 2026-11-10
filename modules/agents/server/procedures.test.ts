/**
 * @jest-environment node
 */
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createCallerFactory } from "@/trpc/init";
import { agentsRouter } from "./procedures";

// trpc/init.ts uses React's server-only cache(), which the Jest build of React does not export.
jest.mock("react", () => ({
    ...jest.requireActual("react"),
    cache: <T,>(fn: T) => fn,
}));

jest.mock("@/app/utils/supabase/server", () => ({
    createSupabaseClient: jest.fn(),
    createSupabaseServiceClient: jest.fn(),
}));

const USER_ID = "user-participant";
const EVENT_A = "event-a";
const EVENT_B = "event-b";
const EVENT_C = "event-c";
const AGENT_X = "agent-x";
const AGENT_Y = "agent-y";

type Result = { data?: unknown; error?: unknown; count?: number };

interface FakeOptions {
    roles?: { event_id: string; role: string }[];
    ownedEvents?: { event_id: string }[];
    agentEvents?: { agent_id: string; event_id: string }[];
    agentEventsError?: { message: string };
}

function createFakeSupabase({ roles = [], ownedEvents = [], agentEvents = [], agentEventsError }: FakeOptions) {
    const agentOrFilters: string[] = [];
    const agentEventsLookups: unknown[][] = [];

    const resultFor = (table: string): Result => {
        switch (table) {
            case "user_event_roles":
                return { data: roles, error: null };
            case "events":
                return { data: ownedEvents, error: null };
            case "agent_events":
                return agentEventsError ? { data: null, error: agentEventsError } : { data: agentEvents, error: null };
            default:
                return { data: [], error: null, count: 0 };
        }
    };

    const from = (table: string) => {
        const builder = {
            select: () => builder,
            eq: (column: string, value: unknown) => {
                if (table === "agent_events" && column === "event_id") agentEventsLookups.push([value]);
                return builder;
            },
            ilike: () => builder,
            order: () => builder,
            range: () => builder,
            or: (filter: string) => {
                if (table === "agents") agentOrFilters.push(filter);
                return builder;
            },
            in: (column: string, values: unknown[]) => {
                if (table === "agent_events" && column === "event_id") agentEventsLookups.push(values);
                return builder;
            },
            then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(resultFor(table)).then(resolve, reject),
        };
        return builder;
    };

    const supabase = {
        auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
        rpc: async () => ({ data: false, error: null }),
        from,
    };

    return { supabase, agentOrFilters, agentEventsLookups };
}

function callGetMany(options: FakeOptions, input: { pageSize: number; eventId?: string }) {
    const fake = createFakeSupabase(options);
    (createSupabaseClient as jest.Mock).mockResolvedValue(fake.supabase);
    const caller = createCallerFactory(agentsRouter)({ userId: USER_ID });
    return { fake, result: caller.getMany(input) };
}

describe("agents.getMany without an eventId", () => {
    it("includes agents linked to the user's events in the items and count queries", async () => {
        const { fake, result } = callGetMany(
            {
                roles: [{ event_id: EVENT_B, role: "participant" }],
                agentEvents: [{ agent_id: AGENT_X, event_id: EVENT_B }],
            },
            { pageSize: 100 }
        );
        await result;

        expect(fake.agentEventsLookups).toContainEqual([EVENT_B]);
        expect(fake.agentOrFilters).toHaveLength(2);
        for (const filter of fake.agentOrFilters) {
            expect(filter).toContain(`id.in.(${AGENT_X})`);
            // Own, event-scoped, and global agents must stay in the list.
            expect(filter).toContain(`user_id.eq.${USER_ID}`);
            expect(filter).toContain(`event_id.in.(${EVENT_B})`);
            expect(filter).toContain("event_id.is.null");
        }
    });

    it("resolves links for owned events too and lists an agent linked to several events once", async () => {
        const { fake, result } = callGetMany(
            {
                roles: [{ event_id: EVENT_B, role: "participant" }],
                ownedEvents: [{ event_id: EVENT_C }],
                agentEvents: [
                    { agent_id: AGENT_X, event_id: EVENT_B },
                    { agent_id: AGENT_X, event_id: EVENT_C },
                    { agent_id: AGENT_Y, event_id: EVENT_C },
                ],
            },
            { pageSize: 100 }
        );
        await result;

        expect(fake.agentEventsLookups).toContainEqual([EVENT_B, EVENT_C]);
        for (const filter of fake.agentOrFilters) {
            expect(filter).toContain(`id.in.(${AGENT_X},${AGENT_Y})`);
        }
    });

    it("omits the linked clause when the user's events have no linked agents", async () => {
        const { fake, result } = callGetMany(
            { roles: [{ event_id: EVENT_B, role: "participant" }] },
            { pageSize: 100 }
        );
        await result;

        expect(fake.agentOrFilters).toEqual([
            `user_id.eq.${USER_ID},event_id.in.(${EVENT_B}),event_id.is.null`,
            `user_id.eq.${USER_ID},event_id.in.(${EVENT_B}),event_id.is.null`,
        ]);
    });

    it("skips the link lookup for a user with no events", async () => {
        const { fake, result } = callGetMany({}, { pageSize: 100 });
        await result;

        expect(fake.agentEventsLookups).toEqual([]);
        expect(fake.agentOrFilters).toEqual([
            `user_id.eq.${USER_ID},event_id.is.null`,
            `user_id.eq.${USER_ID},event_id.is.null`,
        ]);
    });

    it("fails rather than silently hiding linked agents when the lookup errors", async () => {
        const { result } = callGetMany(
            {
                roles: [{ event_id: EVENT_B, role: "participant" }],
                agentEventsError: { message: "agent_events unavailable" },
            },
            { pageSize: 100 }
        );

        await expect(result).rejects.toBeDefined();
    });
});

describe("agents.getMany with an eventId", () => {
    it("only resolves links for the requested event", async () => {
        const { fake, result } = callGetMany(
            {
                roles: [
                    { event_id: EVENT_A, role: "participant" },
                    { event_id: EVENT_B, role: "participant" },
                ],
                agentEvents: [{ agent_id: AGENT_X, event_id: EVENT_B }],
            },
            { pageSize: 100, eventId: EVENT_B }
        );
        await result;

        expect(fake.agentEventsLookups).toContainEqual([EVENT_B]);
        expect(fake.agentOrFilters).toEqual([
            `event_id.eq.${EVENT_B},id.in.(${AGENT_X})`,
            `event_id.eq.${EVENT_B},id.in.(${AGENT_X})`,
        ]);
    });
});
