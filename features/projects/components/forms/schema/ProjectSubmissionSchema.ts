import * as z from "zod";
import { EventSubmissionField } from "@/lib/types";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BUILT_IN_SUBMISSION_FIELD_KEYS = new Set([
  "project_name",
  "project_description",
  "project_url",
  "video_url",
  "cover_image",
  "additional_materials",
]);

export const formSchema = z.object({
  projectName: z.string().min(2, {
    message: "Project name must be at least 2 characters.",
  }),
  leadName: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  leadEmail: z.string().email({
    message: "Please enter a valid email address.",
  }),
  projectDescription: z.string().min(10, {
    message: "Project description must be at least 10 characters.",
  }),
  teammates: z.array(z.string()).optional(),
  projectUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  trackIds: z.array(z.string()),
  coverImage: z
    .custom<FileList>()
    .optional()
    .refine(
      (files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE,
      {
        message: "File size must be less than 10MB",
      },
    ),
  additionalMaterials: z
    .custom<FileList>()
    .optional()
    .refine(
      (files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE,
      {
        message: "File size must be less than 10MB",
      },
    ),
});

export type ProjectSubmissionFormData = z.infer<typeof formSchema>;

export type ProjectSubmissionValidationInput = {
  formData: {
    projectName: string;
    projectDescription: string;
    projectUrl: string;
    videoUrl: string;
    coverImageUrl: string;
    additionalMaterialsUrl: string;
  };
  submissionFields: EventSubmissionField[];
  submissionAnswers: Record<string, string | string[]>;
};

export function createProjectSubmissionPublishSchema(
  submissionFields: EventSubmissionField[],
) {
  return z
    .object({
      projectName: z.string(),
      projectDescription: z.string(),
      projectUrl: z.string(),
      videoUrl: z.string(),
      coverImageUrl: z.string(),
      additionalMaterialsUrl: z.string(),
      submissionAnswers: z.record(z.union([z.string(), z.array(z.string())])),
    })
    .superRefine((data, ctx) => {
      for (const field of submissionFields) {
        if (!field.required) continue;

        switch (field.key) {
          case "project_name":
            if (data.projectName.trim().length < 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["projectName"],
                message: "Project name must be at least 2 characters long.",
              });
            }
            continue;
          case "project_description":
            if (data.projectDescription.trim().length < 10) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["projectDescription"],
                message:
                  "Please provide a more detailed project description (minimum 10 characters).",
              });
            }
            continue;
          case "project_url":
            if (data.projectUrl.trim().length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["projectUrl"],
                message: "Please provide a project URL.",
              });
            }
            continue;
          case "video_url":
            if (data.videoUrl.trim().length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["videoUrl"],
                message: "Please provide a video URL.",
              });
            }
            continue;
          case "cover_image":
            if (data.coverImageUrl.trim().length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["coverImageUrl"],
                message: "Please provide a cover image.",
              });
            }
            continue;
          case "additional_materials":
            if (data.additionalMaterialsUrl.trim().length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["additionalMaterialsUrl"],
                message: "Please provide additional materials.",
              });
            }
            continue;
          default: {
            if (BUILT_IN_SUBMISSION_FIELD_KEYS.has(field.key)) {
              continue;
            }

            const value = data.submissionAnswers[field.id];
            if (field.field_type === "multi_url") {
              if (!Array.isArray(value) || value.every((url) => !url.trim())) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["submissionAnswers", field.id],
                  message: `Please answer "${field.label}" before publishing.`,
                });
              }
              continue;
            }

            if (typeof value !== "string" || value.trim().length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["submissionAnswers", field.id],
                message: `Please answer "${field.label}" before publishing.`,
              });
            }
          }
        }
      }
    });
}
