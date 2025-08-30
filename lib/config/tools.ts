import { z } from "zod";

export type ToolTheme =
  | "amber"
  | "blue"
  | "purple"
  | "orange"
  | "emerald"
  | "cyan";

export type ToolIconName =
  | "Lightbulb"
  | "Globe"
  | "Sparkles"
  | "Presentation"
  | "Eye"
  | "FileText";

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: ToolIconName;
  theme: ToolTheme;
  urlTemplate: string; // Use {contextusId} as placeholder
  badgeText: string;
}

export const ToolDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.enum([
    "Lightbulb",
    "Globe",
    "Sparkles",
    "Presentation",
    "Eye",
    "FileText",
  ]),
  theme: z.enum(["amber", "blue", "purple", "orange", "emerald", "cyan"]),
  urlTemplate: z.string().url().or(z.string().min(1)),
  badgeText: z.string().min(1),
});

export const SUBMISSION_TOOLS: ToolDefinition[] = [
  {
    id: "idea-generator",
    name: "Idea Generator",
    description: "Generate project ideas and inspiration",
    icon: "Lightbulb",
    theme: "amber",
    urlTemplate:
      "https://idea-generation-prd.lovable.app/?contextus_id={contextusId}",
    badgeText: "Works in a new tab",
  },
  {
    id: "shanye",
    name: "Shanye",
    description: "AI-powered development",
    icon: "Globe",
    theme: "blue",
    urlTemplate: "https://www.shanye.io/?contextus_id={contextusId}",
    badgeText: "Direct integration",
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "AI development platform",
    icon: "Sparkles",
    theme: "purple",
    urlTemplate: "https://lovable.dev/?contextus_id={contextusId}",
    badgeText: "AI-powered tools",
  },
  {
    id: "auto-slide-ai",
    name: "Auto Slide AI",
    description: "Generate slides from your project",
    icon: "Presentation",
    theme: "orange",
    urlTemplate:
      "https://auto-slide-ai.lovable.app/?contextus_id={contextusId}",
    badgeText: "Auto-generated slides",
  },
  {
    id: "contextus-visual",
    name: "Contextus Visual",
    description: "Visualize your project context",
    icon: "Eye",
    theme: "emerald",
    urlTemplate:
      "https://contextus-visual.lovable.app/?contextus_id={contextusId}",
    badgeText: "Interactive visualization",
  },
  {
    id: "ai-meeting-notes",
    name: "AI Meeting Note Taker",
    description: "Capture and summarize discussions",
    icon: "FileText",
    theme: "cyan",
    urlTemplate:
      "https://ai-meeting-note-taker.lovable.app/meeting-notes?contextus_id={contextusId}",
    badgeText: "AI-powered notes",
  },
];

// Validate the config at module load (non-fatal in production)
try {
  const validate = z.array(ToolDefinitionSchema).safeParse(SUBMISSION_TOOLS);
  if (!validate.success) {
    // eslint-disable-next-line no-console
    console.warn("Invalid SUBMISSION_TOOLS config:", validate.error.issues);
  }
} catch {
  // no-op
}

