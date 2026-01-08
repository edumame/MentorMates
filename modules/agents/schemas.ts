import { z } from "zod";

const optionalUrl = z.preprocess(
    (value: unknown) => {
        if (typeof value !== "string") return value;
        const trimmed = value.trim();
        // Treat empty input as "not provided" so we don't overwrite DB defaults.
        return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().url({ message: "Image URL must be a valid URL" }).optional()
);

const agentsBaseSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    instructions: z.string().min(1, { message: "Instructions are required" }),
    // Optional avatar image for the agent (stored in `agents.avatar_url`)
    avatar_url: optionalUrl.optional(),
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

