import { Footer } from "@/components/layout/footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Position = {
  id: string;
  title: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  compensation: string[];
  whyJoin: string;
  contactEmail?: string;
};

const positions: Position[] = [
  {
    id: "podcast-host-community-engagement-lead",
    title: "Podcast Host & Community Engagement Lead",
    summary:
      "Host and run our upcoming podcast series and support community engagement.",
    responsibilities: [
      "Co-host a podcast series with our founder, featuring conversations with leading voices in AI, education, and technology.",
      "Take ownership of outreach, preparation, and logistics for each episode.",
      "Research guest speakers, draft guiding questions, and drive engaging conversations.",
      "Support community events, workshops, and collaborations with universities and partners.",
      "Help build transparency and foster meaningful engagement across our community.",
    ],
    requirements: [
      "Strong communication and hosting presence (comfortable leading conversations).",
      "Interest in AI, education, and entrepreneurship.",
      "Experience in community building, event organizing, or media production is a plus.",
      "Highly organized, reliable, and proactive.",
    ],
    compensation: [
      "$500 HKD per episode (with opportunities for growth as the program expands).",
      "Flexible, remote-friendly role.",
    ],
    whyJoin:
      "You’ll gain direct access to industry leaders from organizations like Anthropic, Stanford, Johns Hopkins, and more. This is a chance to build your network, sharpen your skills in public speaking and community building, and contribute to the future of AI and education.",
    contactEmail: "admin@mentormates.ai",
  },
];

export default function HiringPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 pt-16">
        <header className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-3">We&apos;re Hiring</h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-700">
            Join <span className="font-semibold">MentorMates</span> to help build inclusive
            learning and community experiences around AI and entrepreneurship.
          </p>
        </header>

        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900">Open Positions</h2>
            <Badge variant="secondary" className="text-blue-900 bg-blue-100">
              {positions.length} role{positions.length !== 1 ? "s" : ""} open
            </Badge>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {positions.map((position) => (
              <AccordionItem key={position.id} value={position.id} className="border rounded-lg mb-3 bg-white/80">
                <AccordionTrigger className="px-4 py-3 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{position.title}</h3>
                      <p className="text-sm text-gray-700">{position.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800">Part-time</Badge>
                      <Badge className="bg-indigo-100 text-indigo-800">Remote</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-6 text-gray-800">
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-2">About the Role</h4>
                      <ul className="list-disc pl-6 space-y-1">
                        {position.responsibilities.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-2">What We&apos;re Looking For</h4>
                      <ul className="list-disc pl-6 space-y-1">
                        {position.requirements.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Compensation</h4>
                      <ul className="list-disc pl-6 space-y-1">
                        {position.compensation.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Why Join Us</h4>
                      <p className="text-gray-800">{position.whyJoin}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      {position.contactEmail && (
                        <Button asChild className="bg-blue-900 hover:bg-blue-800">
                          <a
                            href={`mailto:${position.contactEmail}?subject=${encodeURIComponent(
                              `Application: ${position.title}`
                            )}`}
                          >
                            Apply via Email
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" asChild>
                        <a href="/join">Back to Join</a>
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>

      <div className="pt-10">
        <Footer />
      </div>
    </div>
  );
}

