import { z } from "zod";

// We accept either:
// - a valid URL string
// - an empty string (user cleared the input)
// - undefined (field not provided)
//
// Then we transform empty string -> undefined, so we don't overwrite DB defaults.
const optionalUrl = z
    .union([z.string().trim().url({ message: "Image URL must be a valid URL" }), z.literal("")])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
    });

const agentsBaseSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    instructions: z.string().min(1, { message: "Instructions are required" }),
    // Optional avatar image for the agent (stored in `agents.avatar_url`)
    avatar_url: optionalUrl,
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

