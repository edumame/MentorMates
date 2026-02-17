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

// For updates we want to allow an explicit empty string so the UI can clear the value.
// This keeps empty string instead of converting it to `undefined` which would skip the
// field during partial updates.
const optionalTextAllowEmpty = z
    .union([z.string(), z.literal("")])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        return (value as string).trim();
    });

// Optional voice helper for inserts: empty string is treated as not provided.
const optionalVoice = z
    .union([z.string().trim(), z.literal("")])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = (value as string).trim();
        return trimmed.length === 0 ? undefined : trimmed;
    });

// Optional voice helper for updates: empty string clears the value.
const optionalVoiceAllowClear = z
    .union([z.string(), z.literal("")])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = (value as string).trim();
        return trimmed.length === 0 ? null : trimmed;
    });

const agentsBaseSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    instructions: z.string().min(1, { message: "Instructions are required" }),
    // Optional avatar image for the agent (stored in `agents.avatar_url`)
    avatar_url: optionalUrl,
    // Optional prompt used when generating feedback/evaluations for this agent
    feedback_prompt: optionalText,
    // Voice setting for realtime conversations. Accepts a built-in voice name
    // (e.g. "alloy") or a custom voice id (e.g. "voice_...").
    voice: optionalVoice,
    event_id: z.string().optional(),
    enabled: z.boolean().optional(),
    // Whether this agent provides an evaluative score (true) or only feedback (false)
    scoring: z.boolean().optional(),
    // Whether this agent requires a project to be selected when creating a meeting
    requires_project: z.boolean().optional(),
    type: z.string().min(1, { message: "Type is required" }),
    // Temporary helper used by the UI when the user chooses the "custom" dropdown option.
    // The form sets `custom_type_tmp` and the submit handler maps it into `type`.
    custom_type_tmp: z.string().optional(),
    // Temporary helper used by the UI when the user chooses "custom" voice.
    custom_voice_tmp: z.string().optional(),
});
export const agentsInsertSchema = agentsBaseSchema;

export const agentsUpdateSchema = agentsBaseSchema
    .omit({ event_id: true })
    .extend({
        feedback_prompt: optionalTextAllowEmpty,
        voice: optionalVoiceAllowClear,
    })
    .partial()
    .extend({
        id: z.string().min(1, { message: "Id is required" }),
        expected_updated_at: z.string().datetime().optional(),
    });
