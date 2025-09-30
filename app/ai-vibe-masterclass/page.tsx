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
    "A 3-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.",
};

export default function AIVibeMasterclassPage() {
  return (
    <section className="relative overflow-hidden">
      {/* Hero */}
      <div className="relative bg-gradient-to-b from-blue-50/70 to-white">
        <BackgroundBeams className="opacity-60" />
        <div className="relative px-4 sm:px-5 pt-10 md:pt-20 pb-8 md:pb-16">
          {/* Mobile-first hero (video first) */}
          <div className="md:hidden mx-auto w-full max-w-md">
            {/* Video */}
            <div className="relative mx-auto w-full overflow-hidden rounded-xl shadow-xl ring-1 ring-gray-200 bg-white">
              <div className="relative pt-[56.25%]">
                <iframe
                  className="absolute inset-0 h-full w-full max-w-full"
                  src="https://www.youtube.com/embed/qYBzs7-GTx8?rel=0"
                  title="AI Vibe Coding Masterclass Intro"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Copy */}
            <div className="mt-6 text-center">
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1">
                AI Vibe Coding Masterclass
              </span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
                Unlock Your AI Vibe
              </h1>
              <p className="text-gray-700 mt-3 text-sm sm:text-base">
                A 3-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 justify-center">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <CalendarClock className="mr-1 h-3.5 w-3.5" /> 3 Weeks
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Users className="mr-1 h-3.5 w-3.5" /> Only 12 seats
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Rocket className="mr-1 h-3.5 w-3.5" /> Build live
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Private WhatsApp Group
                </span>
              </div>
              <div className="mt-6 flex items-center gap-3 justify-center">
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
              <div className="mt-4 text-sm text-gray-700 flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Early bird bonus: 30-min 1:1 with Chinat
              </div>
              <div className="mt-6 flex items-center justify-center gap-3">
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
          </div>

          {/* Desktop/tablet hero */}
          <div className="hidden md:grid max-w-7xl mx-auto md:grid-cols-12 gap-6 md:gap-8 items-center">
            {/* Left: Copy */}
            <div className="md:col-span-5 text-center md:text-left">
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1">
                AI Vibe Coding Masterclass
              </span>
              <h1 className="mt-4 sm:mt-6 text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight">
                Unlock Your AI Vibe
              </h1>
              <p className="text-gray-700 mt-3 sm:mt-4 text-sm sm:text-base md:text-lg">
                A 3-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <CalendarClock className="mr-1 h-3.5 w-3.5" /> 3 Weeks
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Users className="mr-1 h-3.5 w-3.5" /> Only 12 seats
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Rocket className="mr-1 h-3.5 w-3.5" /> Build live
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Private WhatsApp Group
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
                    className="absolute inset-0 h-full w-full max-w-full"
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
        <div className="px-4 sm:px-5 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="hidden sm:block">
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
      </div>

      {/* Meet Your Instructor */}
      <div className="px-4 sm:px-5 py-8">
        <section className="mx-auto w-full max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Meet Your Instructor</h2>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Image
              src="/team/Chinat.png"
              alt="Chinat Yu"
              width={64}
              height={64}
              className="rounded-full"
            />
            <div className="text-left">
              <p className="font-semibold">Chinat Yu</p>
              <p className="text-sm text-gray-600">Instructor • Founder of MentorMates • MLH Top 50 Hacker • Stanford LDT</p>
            </div>
          </div>
          <p className="text-gray-700 mt-4 max-w-3xl mx-auto">
            I’ve built AR science labs, hackathon platforms, and AI feedback systems backed by Stanford and Microsoft. I’ve mentored 200+ builders and led projects recognized by Johns Hopkins, MLH, and Stanford HAI.
          </p>
        </section>
      </div>

      {/* Program Overview */}
      <div className="px-4 sm:px-5 py-10 md:py-16">
        <section className="mx-auto w-full max-w-6xl md:max-w-7xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Program Overview
          </h2>
          <p className="text-gray-700 mt-6 max-w-3xl mx-auto text-center">
            AI Vibe Coding isn’t just about code — it’s about creating with energy, scaling with AI, and thinking like an entrepreneur. In 3 weeks, you’ll climb the BRICK Vibe Ladder, design SNOW Agents, and launch with confidence.
          </p>
          <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Live Weekend Workshops</p>
                  <p className="text-sm text-gray-700 mt-1">2 hours each → build in real time</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Weekly Deep Dive</p>
                  <p className="text-sm text-gray-700 mt-1">1 hour mentorship with Chinat</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <BrainCircuit className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Exclusive Frameworks</p>
                  <p className="text-sm text-gray-700 mt-1">BRICK, ALERT, SNOW Agent</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Private WhatsApp Group</p>
                  <p className="text-sm text-gray-700 mt-1">Peer exchange + lifetime access</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Curriculum Breakdown */}
        <section id="curriculum" className="mx-auto w-full max-w-6xl md:max-w-7xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Curriculum (Week by Week)
          </h2>
          <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 1 – The BRICK Vibe Ladder</h3>
              <p className="text-gray-700 mt-2">Go from spark → prototype → execution with structured creativity.</p>
              <p className="text-gray-800 mt-2"><span className="font-semibold">Outcome:</span> You’ll have your first coded micro-product demo.</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-semibold text-lg">Week 2 – SNOW Agent Framework</h3>
              <p className="text-gray-700 mt-2">Design adaptive AI agents that feel alive.</p>
              <p className="text-gray-800 mt-2"><span className="font-semibold">Outcome:</span> You’ll build and deploy your first cloud-powered agent.</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:col-span-2">
              <h3 className="font-semibold text-lg">Week 3 – Go-to-Market & Entrepreneur Mindset</h3>
              <p className="text-gray-700 mt-2">Turn prototypes into products. Pitch, validate, and embody the AI entrepreneur.</p>
              <p className="text-gray-800 mt-2"><span className="font-semibold">Outcome:</span> You’ll leave with a portfolio project + go-to-market plan.</p>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Why Join */}
        <section className="mx-auto w-full max-w-6xl md:max-w-7xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Why Join?
          </h2>
          <div className="mt-6 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Rocket className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Hands-on</p>
                  <p className="text-sm text-gray-700 mt-1">You’ll ship projects, not just watch slides</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Personalized</p>
                  <p className="text-sm text-gray-700 mt-1">Only 12 seats, high-touch learning</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <BrainCircuit className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">End-to-End</p>
                  <p className="text-sm text-gray-700 mt-1">From code to launch</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">Mentorship</p>
                  <p className="text-sm text-gray-700 mt-1">Weekly sessions + private WhatsApp group</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Tools You’ll Use */}
        <section className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tools You’ll Use</h2>
          <p className="text-gray-700 mt-6">
            OpenAI • Claude • Replit • GitHub • LangChain • Supabase • MentorMates templates
          </p>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Capstone Showcase */}
        <section className="mx-auto w-full max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Capstone Showcase</h2>
          <p className="text-gray-700 mt-6 max-w-3xl mx-auto">
            At the end, you’ll demo your project to the cohort (and invited guests if you choose). Perfect for portfolios, pitches, or your first investor email.
          </p>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Testimonials */}
        <section className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">Testimonials</h2>
          <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-800 italic">“Chinat helped me go from idea to working prototype in one weekend. His frameworks are game-changing.”</p>
              <p className="text-sm text-gray-600 mt-3">— Student, Stanford Hackathon</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <p className="text-gray-800 italic">“I never thought I’d ship an AI agent this fast. The vibe in the cohort was unreal.”</p>
              <p className="text-sm text-gray-600 mt-3">— Early Cohort Participant</p>
            </div>
          </div>
        </section>

        

        {/* Pricing */}
        <section id="reserve" className="mx-auto w-full max-w-lg sm:max-w-xl md:max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Pricing</h2>
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <Badge variant="secondary" className="text-gray-800">Cohort-based • Limited to 12</Badge>
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight">$2,500</p>
              <p className="text-sm text-gray-600">Includes all workshops, weekly sessions, frameworks, and community.</p>
            </div>
            <ul className="mt-6 text-left text-sm text-gray-800 grid gap-2 max-w-md mx-auto">
              <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> 3 live workshops + 3 mentorship sessions</li>
              <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Exclusive frameworks + templates</li>
              <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Private WhatsApp community</li>
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
        <section className="mx-auto w-full max-w-3xl sm:max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Who Is This For?
          </h2>
          <ul className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2 max-w-3xl mx-auto text-gray-800">
            <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Builders who want to scale from idea → product</li>
            <li className="inline-flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Creatives & hackers interested in AI + entrepreneurship</li>
            <li className="inline-flex items-start gap-2 sm:col-span-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Students, early-stage founders, and professionals who want playful, practical AI fluency</li>
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
                  No, curiosity is enough.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Will I launch a startup by the end?</AccordionTrigger>
                <AccordionContent>
                  You’ll leave with a launch-ready project and a roadmap.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Can I use my own project idea?</AccordionTrigger>
                <AccordionContent>
                  Yes, bring it — or jam with the cohort.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>What if I can’t attend live?</AccordionTrigger>
                <AccordionContent>
                  All sessions are recorded, and you’ll have community support.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>Refund policy?</AccordionTrigger>
                <AccordionContent>
                  Full refund if requested before Week 2 begins.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-3xl sm:max-w-5xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            12 Seats. 3 Weeks. Code, Scale, Launch.
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

