import { z } from "zod";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional();

export const meetingsInsertSchema = z.object({
    name: z.string().trim().min(1, { message: "Name is required" }).max(200),
    agentId: z.string().uuid({ message: "A valid agent is required" }),
    eventId: optionalUuid,
    projectId: optionalUuid,
});

export const meetingsUpdateSchema = meetingsInsertSchema.extend({
    id: z.string().uuid({ message: "A valid meeting ID is required" }),
    projectId: optionalUuid,
});

