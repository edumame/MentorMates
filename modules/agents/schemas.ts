import { z } from "zod";

const agentsBaseSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    instructions: z.string().min(1, { message: "Instructions are required" }),
    event_id: z.string().optional(),
    enabled: z.boolean().optional(),
    type: z.enum(["brainstorm", "product", "tech", "judge", "custom"]),
    custom_type: z.string().optional(),
});

export const agentsInsertSchema = agentsBaseSchema.refine((data) => {
    if (data.type === "custom") {
        return typeof data.custom_type === "string" && data.custom_type.trim().length > 0;
    }
    return data.custom_type === undefined || data.custom_type === "";
}, {
    message: "Custom type is required",
    path: ["custom_type"],
});

export const agentsUpdateSchema = agentsBaseSchema.partial().extend({
    id: z.string().min(1, { message: "Id is required" }),
});

