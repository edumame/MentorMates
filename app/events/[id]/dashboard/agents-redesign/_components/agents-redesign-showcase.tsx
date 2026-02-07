import Link from "next/link";
import type { ReactNode } from "react";
import {
  Archivo,
  IBM_Plex_Sans,
  Manrope,
  Newsreader,
  Space_Grotesk,
} from "next/font/google";
import {
  ArrowRight,
  Bot,
  CircleDot,
  Gauge,
  Layers,
  Sparkles,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const DESIGN_SEGMENTS = ["one", "two", "three", "four", "five"] as const;
export type DesignSegment = (typeof DESIGN_SEGMENTS)[number];

const DESIGN_ALIASES: Record<string, DesignSegment> = {
  one: "one",
  "1": "one",
  two: "two",
  "2": "two",
  three: "three",
  "3": "three",
  four: "four",
  "4": "four",
  five: "five",
  "5": "five",
};

interface DesignMeta {
  segment: DesignSegment;
  index: number;
  title: string;
  styleName: string;
  description: string;
}

const DESIGN_META: Record<DesignSegment, DesignMeta> = {
  one: {
    segment: "one",
    index: 1,
    title: "Mission Control",
    styleName: "Signal-first cockpit with compact cards",
    description:
      "High-level metrics up top, quick filters in the middle, and clear action panels below.",
  },
  two: {
    segment: "two",
    index: 2,
    title: "Editorial Workspace",
    styleName: "Whitepaper style with narrative hierarchy",
    description:
      "Less dashboard noise. More explanatory context, cleaner sections, and roomy typography.",
  },
  three: {
    segment: "three",
    index: 3,
    title: "Flow Board",
    styleName: "Ops lane layout by lifecycle stage",
    description:
      "Agents are grouped as Draft, Live, and Needs Tuning so bottlenecks are obvious.",
  },
  four: {
    segment: "four",
    index: 4,
    title: "Grid + Inspector",
    styleName: "Data table with right-side detail panel",
    description:
      "Best for teams that want dense control and side-by-side diagnostics while editing.",
  },
  five: {
    segment: "five",
    index: 5,
    title: "Program Narrative",
    styleName: "Timeline + quality storyline",
    description:
      "Frames each agent as part of an event journey so overlaps and gaps are easier to see.",
  },
};

interface MockAgent {
  id: string;
  name: string;
  stage: "Draft" | "Live" | "Needs tuning";
  role: string;
  owner: string;
  sessions: number;
  feedback: number;
  latency: string;
  coverage: string;
  lastUpdate: string;
}

const MOCK_AGENTS: MockAgent[] = [
  {
    id: "A-01",
    name: "Welcome Concierge",
    stage: "Live",
    role: "First touch onboarding",
    owner: "Ops",
    sessions: 1248,
    feedback: 4.8,
    latency: "0.8s",
    coverage: "92%",
    lastUpdate: "2h ago",
  },
  {
    id: "A-02",
    name: "Track Selector",
    stage: "Live",
    role: "Routing to the right track",
    owner: "Program",
    sessions: 841,
    feedback: 4.6,
    latency: "1.1s",
    coverage: "88%",
    lastUpdate: "5h ago",
  },
  {
    id: "A-03",
    name: "Submission Coach",
    stage: "Needs tuning",
    role: "Final submission checks",
    owner: "Judging",
    sessions: 502,
    feedback: 4.2,
    latency: "1.9s",
    coverage: "73%",
    lastUpdate: "20m ago",
  },
  {
    id: "A-04",
    name: "Sponsor Matchmaker",
    stage: "Draft",
    role: "Team to sponsor matching",
    owner: "Partnerships",
    sessions: 91,
    feedback: 4.4,
    latency: "1.3s",
    coverage: "61%",
    lastUpdate: "1d ago",
  },
  {
    id: "A-05",
    name: "FAQ Resolver",
    stage: "Live",
    role: "Policy and deadline Q&A",
    owner: "Support",
    sessions: 1660,
    feedback: 4.9,
    latency: "0.7s",
    coverage: "95%",
    lastUpdate: "40m ago",
  },
  {
    id: "A-06",
    name: "Judge Rubric Helper",
    stage: "Needs tuning",
    role: "Rubric explanation",
    owner: "Judging",
    sessions: 319,
    feedback: 4.1,
    latency: "2.2s",
    coverage: "67%",
    lastUpdate: "3h ago",
  },
];

const KPI_STRIP = [
  { label: "Active agents", value: "6", sublabel: "+2 this week" },
  { label: "Avg feedback", value: "4.5", sublabel: "out of 5" },
  { label: "Session volume", value: "4,661", sublabel: "last 14 days" },
  { label: "Coverage", value: "79%", sublabel: "event question space" },
];

function getStageTone(stage: MockAgent["stage"]) {
  if (stage === "Live") {
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
  if (stage === "Needs tuning") {
    return "bg-amber-100 text-amber-800 border-amber-300";
  }
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function getStageAgentGroups() {
  return {
    Draft: MOCK_AGENTS.filter((agent) => agent.stage === "Draft"),
    Live: MOCK_AGENTS.filter((agent) => agent.stage === "Live"),
    "Needs tuning": MOCK_AGENTS.filter((agent) => agent.stage === "Needs tuning"),
  };
}

export function resolveDesignSegment(segment: string): DesignSegment | null {
  const normalized = segment.trim().toLowerCase();
  return DESIGN_ALIASES[normalized] ?? null;
}

export function buildDesignHref(eventId: string, segment: DesignSegment): string {
  return `/events/${eventId}/dashboard/agents-redesign/${segment}/design`;
}

export function AgentsRedesignOverview({ eventId }: { eventId: string }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-100 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-emerald-100 blur-2xl" />

        <div className="relative space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            <Bot className="h-3.5 w-3.5" />
            Agents Tab Redesign Sandbox
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Five alternate mock pages for the event dashboard’s Agents tab
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Each concept is intentionally different. Open any route directly, compare
            structure, and decide what direction should replace the current cluttered
            layout.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {DESIGN_SEGMENTS.map((segment) => {
              const meta = DESIGN_META[segment];
              return (
                <Link
                  key={segment}
                  href={buildDesignHref(eventId, segment)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {meta.index}. {meta.title}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DESIGN_SEGMENTS.map((segment) => {
          const meta = DESIGN_META[segment];
          return (
            <Link
              key={segment}
              href={buildDesignHref(eventId, segment)}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Design {meta.index}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{meta.title}</h2>
              <p className="mt-2 text-sm font-medium text-slate-700">{meta.styleName}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{meta.description}</p>
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
                Open route
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function MockPageFrame({
  children,
  eventId,
  segment,
}: {
  children: ReactNode;
  eventId: string;
  segment: DesignSegment;
}) {
  const activeMeta = DESIGN_META[segment];

  return (
    <main className="mx-auto w-full max-w-[1300px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Event dashboard / agents redesign
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {activeMeta.index}. {activeMeta.title}
            </h1>
            <p className="text-sm text-slate-600">{activeMeta.styleName}</p>
          </div>
          <Link
            href={`/events/${eventId}/dashboard/agents-redesign`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Back to overview
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {DESIGN_SEGMENTS.map((item) => {
            const meta = DESIGN_META[item];
            return (
              <Link
                key={item}
                href={buildDesignHref(eventId, item)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  item === segment
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
                )}
              >
                {meta.index}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </main>
  );
}

function DesignOne() {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-b from-cyan-50 via-white to-emerald-50 p-5 sm:p-6 lg:p-8",
        spaceGrotesk.className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Mission control
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Instant signal, less visual clutter
          </h2>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-white/80 p-3 text-right shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Quality pulse</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">Healthy</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_STRIP.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-cyan-100 bg-white/90 p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{kpi.value}</p>
            <p className="text-sm text-slate-600">{kpi.sublabel}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {MOCK_AGENTS.map((agent) => (
          <article
            key={agent.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{agent.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{agent.role}</p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  getStageTone(agent.stage)
                )}
              >
                {agent.stage}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-slate-500">Sessions</p>
                <p className="font-semibold text-slate-900">{agent.sessions}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-slate-500">Feedback</p>
                <p className="font-semibold text-slate-900">{agent.feedback}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-slate-500">Coverage</p>
                <p className="font-semibold text-slate-900">{agent.coverage}</p>
              </div>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">
              Updated {agent.lastUpdate}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DesignTwo() {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 lg:p-9",
        newsreader.className
      )}
    >
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Editorial workspace
          </p>
          <h2 className="max-w-xl text-3xl leading-tight text-slate-900 sm:text-4xl">
            The agents surface can read like a clear operating memo, not a noisy control panel.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-slate-600">
            This mock emphasizes narrative order: what changed, what matters most,
            and what the team should do next. It intentionally reduces decorative
            chrome and prioritizes textual clarity.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Top concerns</p>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
              <li>Submission Coach is over target latency by 0.6s in finals period.</li>
              <li>Judge Rubric Helper has repeated confusion on tie-break criteria.</li>
              <li>Sponsor Matchmaker draft has low scenario coverage for biotech teams.</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {MOCK_AGENTS.slice(0, 4).map((agent) => (
            <article key={agent.id} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                {agent.stage}
              </p>
              <h3 className="mt-2 text-2xl text-slate-900">{agent.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{agent.role}</p>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-700">
                <span>Feedback {agent.feedback}</span>
                <span>{agent.coverage} coverage</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DesignThree() {
  const groups = getStageAgentGroups();

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-5 text-slate-100 sm:p-6 lg:p-8",
        archivo.className
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Flow board</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Organize agents by lifecycle stage
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-slate-300">
          Great for reducing clutter during busy event days: each lane mirrors a clear state.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(["Draft", "Live", "Needs tuning"] as const).map((stage) => (
          <div key={stage} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                {stage}
              </p>
              <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs">
                {groups[stage].length}
              </span>
            </div>
            <div className="space-y-3">
              {groups[stage].map((agent) => (
                <article key={agent.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                  <p className="text-sm font-semibold text-white">{agent.name}</p>
                  <p className="mt-1 text-xs text-slate-300">{agent.role}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <p>Latency: {agent.latency}</p>
                    <p>Feedback: {agent.feedback}</p>
                    <p>Coverage: {agent.coverage}</p>
                    <p>Owner: {agent.owner}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DesignFour() {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 sm:p-6 lg:p-8",
        ibmPlexSans.className
      )}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Grid + inspector</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Structured operations view</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
          <Gauge className="h-4 w-4" />
          Avg response <span className="font-semibold text-slate-900">1.33s</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Feedback</th>
                <th className="px-4 py-3 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_AGENTS.map((agent, idx) => (
                <tr
                  key={agent.id}
                  className={cn(
                    "border-t border-slate-100",
                    idx === 2 && "bg-cyan-50/70"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{agent.name}</p>
                    <p className="text-xs text-slate-500">{agent.role}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium",
                        getStageTone(agent.stage)
                      )}
                    >
                      {agent.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{agent.sessions}</td>
                  <td className="px-4 py-3 text-slate-700">{agent.feedback}</td>
                  <td className="px-4 py-3 text-slate-700">{agent.coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Selected agent</p>
          <h3 className="text-xl font-semibold text-slate-900">Submission Coach</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Users hesitate at final checklist prompts. Suggest shorter answer
            cards and one-click rubric examples for judges.
          </p>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Latency</p>
              <p className="font-semibold text-slate-900">1.9s</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Failed intents</p>
              <p className="font-semibold text-slate-900">12%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Feedback</p>
              <p className="font-semibold text-slate-900">4.2 / 5</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Owner</p>
              <p className="font-semibold text-slate-900">Judging</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Recommended action: split one long guidance block into three quick
            response templates before the deadline rush.
          </div>
        </aside>
      </div>
    </section>
  );
}

function DesignFive() {
  const lanes = [
    {
      phase: "Before teams join",
      focus: "Orientation and role setup",
      agents: MOCK_AGENTS.filter((agent) =>
        ["Welcome Concierge", "Track Selector"].includes(agent.name)
      ),
      signal: "Strong",
    },
    {
      phase: "Build phase",
      focus: "Guidance and blocker removal",
      agents: MOCK_AGENTS.filter((agent) =>
        ["FAQ Resolver", "Sponsor Matchmaker"].includes(agent.name)
      ),
      signal: "Mixed",
    },
    {
      phase: "Submission + judging",
      focus: "Rubric confidence and final checks",
      agents: MOCK_AGENTS.filter((agent) =>
        ["Submission Coach", "Judge Rubric Helper"].includes(agent.name)
      ),
      signal: "Needs work",
    },
  ];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 lg:p-8",
        manrope.className
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Program narrative</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Map agents to the participant journey
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
            <CircleDot className="h-3 w-3" /> Strong
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
            <CircleDot className="h-3 w-3" /> Mixed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">
            <CircleDot className="h-3 w-3" /> Needs work
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {lanes.map((lane) => (
          <article
            key={lane.phase}
            className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{lane.phase}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{lane.focus}</h3>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                  lane.signal === "Strong" && "bg-emerald-100 text-emerald-800",
                  lane.signal === "Mixed" && "bg-amber-100 text-amber-800",
                  lane.signal === "Needs work" && "bg-rose-100 text-rose-800"
                )}
              >
                {lane.signal}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lane.agents.map((agent) => (
                <div key={agent.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-base font-semibold text-slate-900">{agent.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{agent.role}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                    {agent.sessions} sessions, feedback {agent.feedback}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AgentsRedesignMockPage({
  eventId,
  segment,
}: {
  eventId: string;
  segment: DesignSegment;
}) {
  return (
    <MockPageFrame eventId={eventId} segment={segment}>
      {segment === "one" && <DesignOne />}
      {segment === "two" && <DesignTwo />}
      {segment === "three" && <DesignThree />}
      {segment === "four" && <DesignFour />}
      {segment === "five" && <DesignFive />}

      <section className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <Workflow className="h-3.5 w-3.5" />
            Structure
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Does this concept make it easier to scan agent status and spot issues?
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5" />
            Clarity
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Is the content readable enough for long admin sessions?
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <Layers className="h-3.5 w-3.5" />
            Density
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Do we want richer detail on one screen or fewer elements with stronger focus?
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <Bot className="h-3.5 w-3.5" />
            Next step
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Pick one design to merge, then we can wire it into real event agent data.
          </p>
        </div>
      </section>
    </MockPageFrame>
  );
}
