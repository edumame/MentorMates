import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { LogoMarquee } from "@/components/ui/LogoMarquee";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Users,
  CalendarClock,
  Rocket,
  BrainCircuit,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI Vibe Coding Masterclass | MentorMates",
  description:
    "A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.",
};

export default function AIVibeMasterclassPage() {
  return (
    <section className="relative overflow-hidden">
      {/* Hero */}
      <div className="relative bg-gradient-to-b from-blue-50/70 to-white">
        <BackgroundBeams className="opacity-60" />
        <div className="relative px-5 pt-12 md:pt-20 pb-10 md:pb-16">
          <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-8 items-center">
            {/* Left: Copy */}
            <div className="md:col-span-5 text-center md:text-left">
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1">
                AI Vibe Coding Masterclass
              </span>
              <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight">
                Unlock Your AI Vibe
              </h1>
              <p className="text-gray-700 mt-4 text-base md:text-lg">
                A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <CalendarClock className="mr-1 h-3.5 w-3.5" /> 5 Weeks
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Users className="mr-1 h-3.5 w-3.5" /> Only 12 seats
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Rocket className="mr-1 h-3.5 w-3.5" /> Build live
                </span>
              </div>
              <div className="mt-6 flex items-center gap-3 justify-center md:justify-start">
                <Link href="/ai-vibe-masterclass/checkout">
                  <Button variant="default" className="px-4 py-2 text-base">
                    Reserve Your Seat
                  </Button>
                </Link>
                <Link
                  href="#curriculum"
                  className="inline-flex items-center bg-gray-100 px-4 py-2 rounded-xl hover:bg-gray-200"
                >
                  View curriculum
                </Link>
              </div>
              <div className="mt-4 text-sm text-gray-700 flex items-center justify-center md:justify-start gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Early bird bonus: 30-min 1:1 with Chinat
              </div>
              <div className="mt-6 flex items-center justify-center md:justify-start gap-3">
                <Image
                  src="/team/Chinat.png"
                  alt="Chinat Yu"
                  width={44}
                  height={44}
                  className="rounded-full"
                />
                <div>
                  <p className="text-sm font-semibold">Chinat Yu</p>
                  <p className="text-xs text-gray-600">Instructor • MentorMates</p>
                </div>
              </div>
            </div>
            {/* Right: Video */}
            <div className="md:col-span-7">
              <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl shadow-xl ring-1 ring-gray-200 bg-white">
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
            </div>
          </div>
        </div>

        {/* Logo marquee */}
        <div className="px-5 pb-8">
          <div className="max-w-7xl mx-auto">
            <LogoMarquee
              logos={[
                { alt: "Stanford", src: "/partners/stanford.png" },
                { alt: "Goodnotes", src: "/partners/goodnotes.png" },
                { alt: "JHU", src: "/partners/jhu.png" },
                { alt: "HK PolyU", src: "/partners/hkpu.png" },
                { alt: "Tencent", src: "/partners/tencent.png" },
                { alt: "Inspirit AI", src: "/partners/inspirit.png" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Program Overview */}
      <div className="px-5 py-10 md:py-16">
        <section className="mx-auto w-full max-w-7xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Program Overview
          </h2>
          <p className="text-gray-700 mt-6 max-w-3xl mx-auto text-center">
            AI Vibe Coding isn’t just about code — it’s about creating with energy, scaling with AI, and thinking like an entrepreneur. In 5 weeks, you’ll climb the BRICK Vibe Coding Ladder, build cloud-powered agents, and prepare to launch with confidence.
          </p>
          <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">5 Weekend Workshops</p>
                  <p className="text-sm text-gray-700 mt-1">2 hours each → build live.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Weekly Deep Dive</p>
                  <p className="text-sm text-gray-700 mt-1">1 hour with Chinat → mentorship.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <BrainCircuit className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Exclusive Frameworks</p>
                  <p className="text-sm text-gray-700 mt-1">BRICK, ALERT, SNOW Agent.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Cohort of 12</p>
                  <p className="text-sm text-gray-700 mt-1">High-touch, collaborative learning.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Curriculum Breakdown */}
        <section id="curriculum" className="mx-auto w-full max-w-7xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Curriculum Breakdown (Week by Week)
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 1: The BRICK Vibe Coding Ladder</h3>
              <p className="text-gray-700 mt-2">How to climb from spark → prototype → execution using structured creativity.</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 2: ALERT Risk Level</h3>
              <p className="text-gray-700 mt-2">How to push innovation while managing risks and guardrails.</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 3: SNOW Agent Framework</h3>
              <p className="text-gray-700 mt-2">Design adaptive, responsive AI agents that feel alive.</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 4: Parallelization with Cloud Agents</h3>
              <p className="text-gray-700 mt-2">Scale your work: run multiple agents in the cloud, experiment with orchestration and parallel workflows.</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:col-span-2">
              <h3 className="font-semibold text-lg">Week 5: Go-To-Market & Entrepreneur Mindset</h3>
              <p className="text-gray-700 mt-2">Turn prototypes into products. Learn how to pitch, validate markets, and embody the mindset of an AI entrepreneur.</p>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Why Join */}
        <section className="mx-auto w-full max-w-7xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Why Join?
          </h2>
          <div className="mt-6 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Rocket className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Hands-on</p>
                  <p className="text-sm text-gray-700 mt-1">You won’t just learn — you’ll build.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Personalized</p>
                  <p className="text-sm text-gray-700 mt-1">Only 12 seats for deep interaction.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <BrainCircuit className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">End-to-End</p>
                  <p className="text-sm text-gray-700 mt-1">From coding vibes to launching ventures.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Mentorship</p>
                  <p className="text-sm text-gray-700 mt-1">Weekly sessions with Chinat to guide your journey.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        

        {/* Pricing */}
        <section id="reserve" className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Pricing</h2>
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <Badge variant="secondary" className="text-gray-800">Cohort-based • Limited to 12</Badge>
              <p className="text-4xl font-extrabold tracking-tight">$2,500</p>
              <p className="text-sm text-gray-600">Includes all workshops, weekly sessions, frameworks, and community.</p>
            </div>
            <ul className="mt-6 text-left text-sm text-gray-800 grid gap-2 max-w-md mx-auto">
              <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> 5 workshops + 5 deep dives</li>
              <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Exclusive frameworks + templates</li>
              <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Community access and support</li>
              <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Early bird 1:1 with Chinat</li>
            </ul>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href="/ai-vibe-masterclass/checkout">
                <Button variant="default" className="px-4 py-2 text-base">
                  Reserve Your Seat
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Who Is This For */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Who Is This For?
          </h2>
          <ul className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2 max-w-3xl mx-auto text-gray-800">
            <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Builders who want to scale from idea → product.</li>
            <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Creatives and hackers interested in coding AND entrepreneurship.</li>
            <li className="inline-flex items-start gap-2 sm:col-span-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Early-stage founders, students, and professionals who want to apply AI in a playful yet practical way.</li>
          </ul>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* FAQ */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            FAQ
          </h2>
          <div className="mt-8 max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Do I need coding background?</AccordionTrigger>
                <AccordionContent>
                  A little helps, but this is about creativity + entrepreneurship as much as coding.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Will I launch a startup by the end?</AccordionTrigger>
                <AccordionContent>
                  You’ll walk away with the skills, mindset, and frameworks to take your projects to market.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Can I use my own project idea?</AccordionTrigger>
                <AccordionContent>
                  Absolutely — the frameworks apply directly.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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

