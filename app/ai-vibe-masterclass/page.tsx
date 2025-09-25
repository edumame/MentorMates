import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "AI Vibe Coding Masterclass | MentorMates",
  description:
    "A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.",
};

export default function AIVibeMasterclassPage() {
  return (
    <section className="relative overflow-hidden">
      <div className="px-5 py-8 md:py-16">
        {/* Hero */}
        <div className="max-w-5xl mx-auto text-center">
          <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl shadow-xl">
            <div className="relative pt-[56.25%]">
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube.com/embed/qYBzs7-GTx8?rel=0"
                title="AI Vibe Coding Masterclass Intro"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>

          <h1 className="mt-10 text-4xl md:text-6xl font-extrabold tracking-tight">
            Unlock Your AI Vibe: Master Coding, Agents, and Entrepreneurship
          </h1>
          <p className="text-gray-700 mt-4 text-base md:text-lg max-w-3xl mx-auto">
            A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/ai-vibe-masterclass/checkout">
              <Button variant="default" className="px-4 py-2 text-base">
                Reserve Your Seat
              </Button>
            </Link>
          </div>
        </div>

        <hr className="my-12 border-gray-200" />

        {/* Program Overview */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Program Overview
          </h2>
          <p className="text-gray-700 mt-6 max-w-3xl mx-auto text-center">
            AI Vibe Coding isn’t just about code — it’s about creating with energy, scaling with AI, and thinking like an entrepreneur. In 5 weeks, you’ll climb the BRICK Vibe Coding Ladder, build cloud-powered agents, and prepare to launch with confidence.
          </p>
          <ul className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2 max-w-3xl mx-auto text-gray-800">
            <li>5 Weekend Workshops (2 hours each) → Build live.</li>
            <li>Weekly Deep Dive with Chinat (1 hour) → Reflection + mentorship.</li>
            <li>Exclusive Frameworks: BRICK Ladder, ALERT Risk Level, SNOW Agent Framework.</li>
            <li>Only 12 participants → High-touch, collaborative learning.</li>
          </ul>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Curriculum Breakdown */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Curriculum Breakdown (Week by Week)
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 1: The BRICK Vibe Coding Ladder</h3>
              <p className="text-gray-700 mt-2">How to climb from spark → prototype → execution using structured creativity.</p>
            </div>
            <div className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 2: ALERT Risk Level</h3>
              <p className="text-gray-700 mt-2">How to push innovation while managing risks and guardrails.</p>
            </div>
            <div className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 3: SNOW Agent Framework</h3>
              <p className="text-gray-700 mt-2">Design adaptive, responsive AI agents that feel alive.</p>
            </div>
            <div className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 4: Parallelization with Cloud Agents</h3>
              <p className="text-gray-700 mt-2">Scale your work: run multiple agents in the cloud, experiment with orchestration and parallel workflows.</p>
            </div>
            <div className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-gray-100 sm:col-span-2">
              <h3 className="font-semibold text-lg">Week 5: Go-To-Market & Entrepreneur Mindset</h3>
              <p className="text-gray-700 mt-2">Turn prototypes into products. Learn how to pitch, validate markets, and embody the mindset of an AI entrepreneur.</p>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Why Join */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Why Join?
          </h2>
          <ul className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2 max-w-3xl mx-auto text-gray-800">
            <li>Hands-on: You won’t just learn — you’ll build.</li>
            <li>Personalized: Only 12 seats for deep interaction.</li>
            <li>End-to-End: From coding vibes to launching ventures.</li>
            <li>Mentorship: Weekly sessions with Chinat to guide your journey.</li>
          </ul>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Pricing */}
        <section id="reserve" className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Pricing</h2>
          <p className="text-gray-700 mt-4">Tuition: $2,500</p>
          <p className="text-gray-700 mt-2">Includes all workshops, weekly sessions, frameworks, and community.</p>
          <p className="text-gray-800 mt-2 font-medium">Early bird bonus: 30-min 1:1 with Chinat.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/ai-vibe-masterclass/checkout">
              <Button variant="default" className="px-4 py-2 text-base">
                Reserve Your Seat
              </Button>
            </Link>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Who Is This For */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Who Is This For?
          </h2>
          <ul className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2 max-w-3xl mx-auto text-gray-800">
            <li>Builders who want to scale from idea → product.</li>
            <li>Creatives and hackers interested in coding AND entrepreneurship.</li>
            <li>Early-stage founders, students, and professionals who want to apply AI in a playful yet practical way.</li>
          </ul>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* FAQ */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            FAQ
          </h2>
          <div className="mt-8 space-y-6 max-w-3xl mx-auto">
            <div>
              <h3 className="font-semibold">Do I need coding background?</h3>
              <p className="text-gray-700 mt-1">A little helps, but this is about creativity + entrepreneurship as much as coding.</p>
            </div>
            <div>
              <h3 className="font-semibold">Will I launch a startup by the end?</h3>
              <p className="text-gray-700 mt-1">You’ll walk away with the skills, mindset, and frameworks to take your projects to market.</p>
            </div>
            <div>
              <h3 className="font-semibold">Can I use my own project idea?</h3>
              <p className="text-gray-700 mt-1">Absolutely — the frameworks apply directly.</p>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            12 Seats. 5 Weeks. Code, Scale, Launch.
          </h2>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/ai-vibe-masterclass/checkout">
              <Button variant="default" className="px-4 py-2 text-base">
                Reserve Your Seat Now
              </Button>
            </Link>
          </div>
        </section>
      </div>

      <Footer />
    </section>
  );
}

