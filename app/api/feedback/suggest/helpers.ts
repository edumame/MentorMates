import { z } from "zod";

export const suggestionSchema = z.object({
  "more specific": z.string().trim().min(1).max(2000),
  "more actionable": z.string().trim().min(1).max(2000),
  "more positive": z.string().trim().min(1).max(2000),
});

export type FeedbackSuggestions = z.infer<typeof suggestionSchema>;

/** Per-user quota, enforced in the database (consume_feedback_suggestion_quota). */
export const SUGGESTION_QUOTA = { limit: 20, window: "1 hour" } as const;
