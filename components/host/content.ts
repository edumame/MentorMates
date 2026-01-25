
export type Bullet = {
  icon?: { name: string };
  title: string;
  body: string;
};

export type ServiceSectionData = {
  id: string;
  eyebrow?: string;
  title: string;
  body: string;
  bullets?: Bullet[];
  cta?: { label: string; href: string };
  image: { src: string; alt: string };
  imageSide?: "left" | "right";
};

export const SERVICES_SECTIONS: ServiceSectionData[] = [
  {
    id: "why",
    eyebrow: "Why MentorMates",
    title: "We power your innovation ecosystem",
    body: "More than one-off events — we help your org create a living lab for ideas.",
    bullets: [
      {
        icon: { name: "RefreshCcw" },
        title: "Continuous creation",
        body: "Projects don't end with the final pitch. We make it easy to discover, remix, and evolve work across time.",
      },
      {
        icon: { name: "Hammer" },
        title: "End-to-end support",
        body: "From event planning to mentorship matching, engineering infrastructure, feedback loops, and analytics — we handle it all.",
      },
      {
        icon: { name: "Medal" },
        title: "Internal visibility & recognition",
        body: "Give ideas a stage. Celebrate creators. Surface hidden talent and cross-team collaboration.",
      },
      {
        icon: { name: "BarChart" },
        title: "Strategic outcomes",
        body: "Align events with goals: employee engagement, product innovation, upskilling, culture building.",
      },
    ],
    image: { src: "/img/event.png", alt: "Innovation ecosystem" },
    imageSide: "right",
  },
  {
    id: "how",
    eyebrow: "How It Works",
    title: "How It Works",
    body: "",
    bullets: [
      {
        icon: { name: "Activity" },
        title: "1. Launch a Hackathon",
        body: "You pick themes, scale, timing. We support you with setup, templates, tools, mentorship, and infrastructure.",
      },
      {
        icon: { name: "Users" },
        title: "2. Build & Collaborate",
        body: "Teams ideate, code, iterate. Use workshops, office hours, community Q&A, versioning, remixing.",
      },
      {
        icon: { name: "Presentation" },
        title: "3. Showcase & Grow",
        body: "Present work. Projects live on in the marketplace. Leaders and peers can browse, remix, mentor, invest.",
      },
      {
        icon: { name: "ChartArea" },
        title: "4. Measure & Iterate",
        body: "Dashboards give you insight into participation, value created, outcomes achieved. Use data to improve the next cycle.",
      },
    ],
    image: { src: "/img/sponsorship.png", alt: "How it works" },
    imageSide: "left",
  },
  {
    id: "participants",
    eyebrow: "For Internal Builders",
    title: "For Internal Builders / Participants",
    body: "",
    bullets: [
      {
        icon: { name: "Share" },
        title: "Share your work and get feedback",
        body: "",
      },
      {
        icon: { name: "Network" },
        title: "Discover others' projects to remix",
        body: "",
      },
      {
        icon: { name: "School" },
        title: "Grow your skills publicly",
        body: "",
      },
      {
        icon: { name: "Award" },
        title: "Get recognized in your org",
        body: "",
      },
    ],
    cta: { label: "Join Your Company’s Innovation Lab", href: "/login" },
    image: { src: "/img/logistics.png", alt: "Internal builders" },
    imageSide: "right",
  },
];
