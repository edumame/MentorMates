import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { LogoMarquee } from "@/components/ui/LogoMarquee";
import { CalendarClock, Users, Rocket, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Vibe Coding Masterclass | MentorMates",
  description:
    "A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.",
};

export default function AIVibeMasterclassPage() {
  const logos = [
    { alt: "Stanford", src: "/partners/stanford.png" },
    { alt: "Goodnotes", src: "/partners/goodnotes.png" },
    { alt: "Inspirit", src: "/partners/inspirit.png" },
    { alt: "JHU", src: "/partners/jhu.png" },
    { alt: "Tencent", src: "/partners/tencent.png" },
    { alt: "HKPU", src: "/partners/hkpu.png" },
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="px-5 py-8 md:py-16">
        {/* Hero */}
        <div className="relative mx-auto w-full max-w-6xl">
          <div className="absolute inset-0 -z-10">
            <BackgroundBeams />
          </div>
          <div className="grid gap-8 md:grid-cols-12 items-center">
            <div className="md:col-span-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Cohort</Badge>
                <Badge variant="outline">5 Weeks</Badge>
                <Badge variant="outline">12 Seats</Badge>
              </div>
              <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight">
                Unlock Your AI Vibe
              </h1>
              <p className="text-gray-700 mt-4 text-base md:text-lg">
                A high-impact masterclass blending AI, code, and entrepreneurial energy. Build agents, scale in the cloud, and launch with confidence.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Link href="/ai-vibe-masterclass/checkout">
                  <Button variant="default" className="px-4 py-2 text-base">
                    Reserve Your Seat
                  </Button>
                </Link>
                <a href="#curriculum" className="inline-flex items-center bg-gray-100 px-4 py-2 rounded-xl hover:bg-gray-200">
                  View curriculum
                </a>
              </div>
            </div>
            <div className="md:col-span-6">
              <div className="relative overflow-hidden rounded-xl shadow-xl ring-1 ring-gray-100">
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
          <div className="mt-10">
            <LogoMarquee logos={logos} />
          </div>
        </div>

        <hr className="my-12 border-gray-200" />

        {/* Program Overview */}
        <section className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Program Overview
          </h2>
          <p className="text-gray-700 mt-6 max-w-3xl mx-auto text-center">
            Create with energy, scale with AI, and think like an entrepreneur. In 5 weeks, you’ll climb the BRICK Vibe Coding Ladder, build cloud-powered agents, and prepare to launch.
          </p>
          <div className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarClock className="h-5 w-5 text-blue-600" /> 5 Weekend Workshops
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">2 hours each — build live with guidance.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-blue-600" /> Weekly Deep Dives
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">1 hour with Chinat — reflection and mentorship.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Rocket className="h-5 w-5 text-blue-600" /> Exclusive Frameworks
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">BRICK Ladder, ALERT Risk Level, SNOW Agent Framework.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" /> Intimate Cohort
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">Only 12 participants — high-touch, collaborative learning.</CardContent>
            </Card>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Curriculum Breakdown */}
        <section id="curriculum" className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Curriculum Breakdown (Week by Week)
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Week 1: The BRICK Vibe Coding Ladder</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">How to climb from spark → prototype → execution using structured creativity.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Week 2: ALERT Risk Level</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">How to push innovation while managing risks and guardrails.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Week 3: SNOW Agent Framework</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">Design adaptive, responsive AI agents that feel alive.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Week 4: Parallelization with Cloud Agents</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">Scale your work: run multiple agents in the cloud; experiment with orchestration and parallel workflows.</CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Week 5: Go-To-Market & Entrepreneur Mindset</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-gray-700">Turn prototypes into products. Learn how to pitch, validate markets, and embody the mindset of an AI entrepreneur.</CardContent>
            </Card>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Why Join */}
        <section className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            Why Join?
          </h2>
          <div className="mt-6 grid gap-4 sm:gap-6 sm:grid-cols-2 max-w-4xl mx-auto text-gray-800">
            <Card>
              <CardContent className="pt-6">Hands-on: You won’t just learn — you’ll build.</CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">Personalized: Only 12 seats for deep interaction.</CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">End-to-End: From coding vibes to launching ventures.</CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">Mentorship: Weekly sessions with Chinat to guide your journey.</CardContent>
            </Card>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Pricing */}
        <section id="reserve" className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">Pricing</h2>
          <div className="mt-8 grid place-items-center">
            <Card className="w-full max-w-xl border-blue-200">
              <CardHeader>
                <CardTitle className="text-center">AI Vibe Coding Masterclass</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-extrabold tracking-tight">$2,500</div>
                  <p className="text-gray-700 mt-2">Includes all workshops, weekly sessions, frameworks, and community.</p>
                  <p className="text-gray-800 mt-2 font-medium">Early bird bonus: 30-min 1:1 with Chinat.</p>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <Link href="/ai-vibe-masterclass/checkout">
                      <Button variant="default" className="px-4 py-2 text-base">
                        Reserve Your Seat
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <hr className="my-12 border-gray-200" />

        {/* Who Is This For */}
        <section className="mx-auto w-full max-w-6xl">
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
        <section className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
            FAQ
          </h2>
          <div className="mt-8 max-w-3xl mx-auto">
            <Accordion type="single" collapsible>
              <AccordionItem value="q1">
                <AccordionTrigger>Do I need coding background?</AccordionTrigger>
                <AccordionContent>
                  A little helps, but this is about creativity and entrepreneurship as much as coding.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>Will I launch a startup by the end?</AccordionTrigger>
                <AccordionContent>
                  You’ll walk away with the skills, mindset, and frameworks to take your projects to market.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
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
        <section className="mx-auto w-full max-w-6xl text-center">
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

