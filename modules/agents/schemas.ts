import { z } from "zod";

export const agentsInsertSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    instructions: z.string().min(1, { message: "Instructions are required" }),
    event_id: z.string().optional(),
    enabled: z.boolean().optional(),
});

export const agentsUpdateSchema = agentsInsertSchema.partial().extend({
    id: z.string().min(1, { message: "Id is required" }),
});

