export const FAMILIARITY_OPTIONS = [
  {
    value: "beginner",
    label:
      "Beginner — I’ve never built with AI, or I only know the basics",
  },
  {
    value: "intermediate",
    label: "Intermediate — I’ve created some projects using AI.",
  },
  {
    value: "advanced",
    label: "Advanced — I’ve built with AI professionally or extensively",
  },
  
] as const;

export const FAMILIARITY_VALUES = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

export const GOAL_OPTIONS = [
  { value: "build_project", label: "Build a project" },
  { value: "start_startup", label: "Start or grow a startup" },
  { value: "learn_skills", label: "Learn new skills" },
  { value: "prepare_jobs", label: "Prepare for jobs/career" },
  { value: "join_community", label: "Join a community / meet people" },
  { value: "exploring", label: "Just exploring, not sure yet" },
] as const;

export const GOAL_VALUES = [
  "build_project",
  "start_startup",
  "learn_skills",
  "prepare_jobs",
  "join_community",
  "exploring",
] as const;

export const ROLE_OPTIONS = [
  { value: "developer", label: "Developer / Engineer" },
  { value: "design", label: "UX / UI Design" },
  { value: "product", label: "Product / PM" },
  { value: "research", label: "Research / Data" },
  { value: "marketing", label: "Marketing / Growth" },
  { value: "founder", label: "Founder" },
  { value: "it_security", label: "IT & Security" },
  { value: "other", label: "Other" },
] as const;

export const ROLE_VALUES = [
  "developer",
  "design",
  "product",
  "research",
  "marketing",
  "founder",
  "it_security",
  "other",
] as const;

export const INDUSTRY_OPTIONS = [
  { value: "education", label: "Education" },
  { value: "health", label: "Health" },
  { value: "gaming", label: "Gaming" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "transport", label: "Transport" },
  { value: "climate", label: "Climate / Sustainability" },
  { value: "accessibility", label: "Accessibility" },
  { value: "finance_business", label: "Finance / Business" },
  { value: "other", label: "Other" },
] as const;

export const INDUSTRY_VALUES = [
  "education",
  "health",
  "gaming",
  "manufacturing",
  "transport",
  "climate",
  "accessibility",
  "finance_business",
  "other",
] as const;

export const AI_TECH_CATEGORIES = [
  {
    id: "creativity_productivity",
    label: "AI for Creativity & Productivity",
    items: [
      { value: "gamma", label: "AI for slide generation (Gamma)" },
      { value: "chatgpt", label: "AI for writing & research (ChatGPT)" },
      { value: "claude", label: "AI for writing & research (Claude)" },
      { value: "canva_ai", label: "AI for design (Canva AI)" },
      { value: "figma_ai", label: "AI for design (Figma AI)" },
      { value: "notion_ai", label: "AI for project tracking & organization (Notion AI)" },
    ],
  },
  {
    id: "building_coding",
    label: "AI for Building & Coding",
    items: [
      { value: "replit", label: "AI for website/app building (Replit)" },
      { value: "cursor", label: "AI coding assistants (Cursor)" },
      { value: "copilot", label: "AI coding assistants (Copilot)" },
      { value: "data_analysis_visualization", label: "AI for data analysis & visualization" },
    ],
  },
  {
    id: "communication_collaboration",
    label: "AI for Communication & Collaboration",
    items: [
      { value: "meeting_transcripts", label: "Meeting transcript & summarization" },
      { value: "async_team_updates", label: "AI for async team updates (voice → text → task tools)" },
      { value: "email_chat_drafting", label: "AI for email/chat drafting (Superhuman AI, Gmail AI, Slack AI add-ons)" },
    ],
  },
] as const;

export const AI_TOOL_VALUES = [
  "gamma",
  "chatgpt",
  "claude",
  "canva_ai",
  "figma_ai",
  "notion_ai",
  "replit",
  "cursor",
  "copilot",
  "data_analysis_visualization",
  "meeting_transcripts",
  "async_team_updates",
  "email_chat_drafting",
] as const;

export const NON_AI_TECH_CATEGORIES = [
  {
    id: "languages_frameworks",
    label: "Programming Languages & Frameworks",
    items: [
      { value: "python", label: "Python" },
      { value: "javascript_typescript", label: "JavaScript / TypeScript" },
      { value: "cpp", label: "C++" },
      { value: "java", label: "Java" },
      { value: "go_rust", label: "Go / Rust" },
      { value: "web_frameworks", label: "Web frameworks (React, Next.js, Vue)" },
    ],
  },
  {
    id: "core_stacks",
    label: "Core Tech Stacks",
    items: [
      { value: "databases_sql", label: "Databases (SQL)" },
      { value: "cloud_platforms", label: "Cloud Platforms (AWS, GCP)" },
      { value: "devops_infra", label: "DevOps / Infra (Docker, Kubernetes, GitHub Actions)" },
    ],
  },
  {
    id: "other_tools",
    label: "Other Tools",
    items: [
      { value: "no_code_low_code", label: "No-code / Low-code Automation" },
      { value: "cybersecurity_networking", label: "Cybersecurity / Networking" },
      { value: "productivity_tools", label: "Traditional productivity tools (Excel, Tableau, etc.)" },
    ],
  },
] as const;

export const NON_AI_TOOL_VALUES = [
  "python",
  "javascript_typescript",
  "cpp",
  "java",
  "go_rust",
  "web_frameworks",
  "databases_sql",
  "cloud_platforms",
  "devops_infra",
  "no_code_low_code",
  "cybersecurity_networking",
  "productivity_tools",
] as const;

// Platform role options - how users want to participate on MentorMates
export const PLATFORM_ROLE_OPTIONS = [
  {
    value: "participant",
    label: "Participant",
    description: "I want to join hackathons and build projects with teams",
    icon: "rocket",
  },
  {
    value: "mentor",
    label: "Mentor",
    description: "I want to guide and support participants during events",
    icon: "graduation-cap",
  },
  {
    value: "judge",
    label: "Judge",
    description: "I want to evaluate and score projects at events",
    icon: "scale",
  },
  {
    value: "organizer",
    label: "Organizer",
    description: "I want to host and manage hackathon events",
    icon: "calendar",
  },
] as const;

export const PLATFORM_ROLE_VALUES = ["participant", "mentor", "judge", "organizer"] as const;

export type PlatformRole = (typeof PLATFORM_ROLE_VALUES)[number];

// Redirect destinations based on platform role selection
export const PLATFORM_ROLE_REDIRECTS: Record<PlatformRole, string> = {
  participant: "/events?role=participant",
  mentor: "/events?role=mentor",
  judge: "/events?role=judge",
  organizer: "/events?role=organizer",
};

