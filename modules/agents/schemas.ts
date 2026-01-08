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
    type: z.string().min(1, { message: "Type is required" }),
    // Temporary helper used by the UI when the user chooses the "custom" dropdown option.
    // The form sets `custom_type_tmp` and the submit handler maps it into `type`.
    custom_type_tmp: z.string().optional(),
});
export const agentsInsertSchema = agentsBaseSchema.refine((data) => {
    if (data.type === "custom") {
        return typeof data.custom_type_tmp === "string" && data.custom_type_tmp.trim().length > 0;
    }
    return true;
}, {
    message: "Custom type is required",
    path: ["custom_type_tmp"],
});

export const agentsUpdateSchema = agentsBaseSchema
    .partial()
    .extend({ id: z.string().min(1, { message: "Id is required" }) })
    .refine((data) => {
        // For updates, only enforce custom_type_tmp when the client includes type === 'custom'
        if ((data.type as string) === "custom") {
            return typeof data.custom_type_tmp === "string" && data.custom_type_tmp.trim().length > 0;
        }
        return true;
    }, {
        message: "Custom type is required",
        path: ["custom_type_tmp"],
    });

