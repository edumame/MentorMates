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

// Optional text helper: accept string, empty string, or undefined; empty -> undefined
const optionalText = z
    .union([z.string().trim(), z.literal("")])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = (value as string).trim();
        return trimmed.length === 0 ? undefined : trimmed;
    });

const agentsBaseSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    instructions: z.string().min(1, { message: "Instructions are required" }),
    // Optional avatar image for the agent (stored in `agents.avatar_url`)
    avatar_url: optionalUrl,
    // Optional prompt used when generating feedback/evaluations for this agent
    feedback_prompt: optionalText,
    event_id: z.string().optional(),
    enabled: z.boolean().optional(),
    type: z.string().min(1, { message: "Type is required" }),
    // Temporary helper used by the UI when the user chooses the "custom" dropdown option.
    // The form sets `custom_type_tmp` and the submit handler maps it into `type`.
    custom_type_tmp: z.string().optional(),
});
export const agentsInsertSchema = agentsBaseSchema;

export const agentsUpdateSchema = agentsBaseSchema
    .partial()
    .extend({ id: z.string().min(1, { message: "Id is required" }) });

