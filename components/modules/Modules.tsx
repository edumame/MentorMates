import Link from "next/link";
import {
  MODULE_STATUS_LABEL,
  mentorMatesModules,
  type MentorMatesModule,
  type ModuleStatus,
} from "@/lib/modules";

const STATUS_STYLES: Record<ModuleStatus, string> = {
  live: "bg-emerald-50 text-emerald-700 border-emerald-200",
  building: "bg-[#DBEAFE] text-[#2563C8] border-[#BFD7FB]",
  planned: "bg-gray-100 text-gray-600 border-gray-200",
};

function StatusPill({ status }: { status: ModuleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {MODULE_STATUS_LABEL[status]}
    </span>
  );
}

function ModuleCard({
  module,
  index,
}: {
  module: MentorMatesModule;
  index: number;
}) {
  const isExternal = module.url?.startsWith("http") ?? false;
  const body = (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-colors hover:border-[#4B89EF]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-gray-400">{index + 1}.</span>
        <StatusPill status={module.status} />
      </div>
      <h3 className="text-xl font-semibold text-gray-900">{module.name}</h3>
      <p className="mt-1 text-base font-medium text-[#2563C8]">
        {module.oneLiner}
      </p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">
        {module.description}
      </p>
      <div className="mt-5 space-y-1 text-xs text-gray-500">
        <p>
          <span className="font-medium text-gray-700">Runs at:</span>{" "}
          {module.communities.join(", ")}
        </p>
        {module.modeledAfter ? (
          <p>
            <span className="font-medium text-gray-700">Modeled after:</span>{" "}
            {module.modeledAfter}
          </p>
        ) : null}
        {module.url ? (
          <p className="pt-1 font-medium text-[#4B89EF]">
            {isExternal ? "Open" : "Open on MentorMates"}
          </p>
        ) : (
          <p className="pt-1 text-gray-400">Private to the community team</p>
        )}
      </div>
    </div>
  );

  if (!module.url) return body;
  if (isExternal) {
    return (
      <a
        href={module.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={module.url} className="block h-full">
      {body}
    </Link>
  );
}

export function Modules() {
  const live = mentorMatesModules.filter((m) => m.status === "live").length;

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium tracking-wide text-[#2563C8]">
            Modules
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
            MentorMates is a list of modules.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
            Every founder community needs the same handful of tools: a way to
            run events, get hired, find a co-founder, ask a question, and look
            each other up. MentorMates ships each one as a module. Turn on the
            ones you need. They share one identity, one design, and one team
            behind them.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            {live} live today. Stanford Founders runs all of them.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mentorMatesModules.map((module, index) => (
              <ModuleCard key={module.slug} module={module} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How it fits */}
      <section className="bg-[#F7FAFE] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            How it fits together
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-[#2563C8]">
                1. Your community
              </p>
              <p className="mt-2 text-base leading-relaxed text-gray-700">
                A university club, an accelerator cohort, a hackathon series. It
                keeps its own name, domain and brand in front of members.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#2563C8]">
                2. The modules it turns on
              </p>
              <p className="mt-2 text-base leading-relaxed text-gray-700">
                Start with events. Add jobs when companies want to hire, add
                co-founder matching when an incubator needs teams. Each module
                is useful alone and better together, because a member is one
                profile across all of them.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#2563C8]">
                3. Powered by MentorMates
              </p>
              <p className="mt-2 text-base leading-relaxed text-gray-700">
                One sign-in, one design system, one team that builds, hosts and
                maintains it. Organizers manage everything from the dashboard
                or from Claude Code through the agent API.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Bring the modules to your community
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
            We run the events module for hackathons and demo days today and are
            rolling the rest out with Stanford Founders. If your club or
            program wants in, tell us which modules you need.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="mailto:contact@mentormates.ai?subject=Modules%20for%20our%20community"
              className="inline-flex items-center rounded-full bg-[#4B89EF] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#2563C8]"
            >
              Email contact@mentormates.ai
            </a>
            <Link
              href="/host"
              className="inline-flex items-center rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-800 hover:border-[#4B89EF]"
            >
              Host an event with us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
