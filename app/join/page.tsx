import { Footer } from "@/components/layout/footer";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-16">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-3">
            Join <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">MentorMates</span>
          </h1>
          <p className="max-w-prose mx-auto text-lg text-gray-700">
            Pick how you’d like to get involved.
          </p>
        </div>

        {/* Role-based Tabs */}
        <section className="bg-white/70 shadow-lg p-4 md:p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <Tabs defaultValue="mentor-judge" className="w-full">
            <div className="flex flex-col items-center">
              <TabsList className="w-full max-w-xl">
                <TabsTrigger value="mentor-judge" className="flex-1">Mentors &amp; Judges</TabsTrigger>
                <TabsTrigger value="organizers" className="flex-1">Organizers</TabsTrigger>
                <TabsTrigger value="careers" className="flex-1">Careers</TabsTrigger>
              </TabsList>
            </div>

            {/* Mentors & Judges */}
            <TabsContent value="mentor-judge" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-white/60">
                  <CardHeader>
                    <CardTitle>Why mentor or judge with us?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-gray-800">
                    <ul className="list-disc list-inside space-y-2">
                      <li>Make a direct impact on students and early builders.</li>
                      <li>Public recognition on event pages and materials.</li>
                      <li>Verification letters and documentation of your service.</li>
                      <li>
                        Helpful for <strong>O-1</strong> or <strong>EB‑1A</strong> visa evidence as
                        expert contributions and judging activities.
                      </li>
                    </ul>
                    <p className="text-sm text-gray-600">
                      Questions? Email <a href="mailto:admin@mentormates.ai" className="text-blue-900 underline hover:text-blue-700">admin@mentormates.ai</a>.
                    </p>
                    <div>
                      <a
                        href="https://forms.gle/uUwgspDN8fQmHjiB6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200"
                      >
                        Fill Interest Form
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <iframe
                    src="https://forms.gle/uUwgspDN8fQmHjiB6"
                    className="w-full h-[900px] md:h-[1100px] rounded-md border bg-white"
                    loading="lazy"
                    title="Mentor & Judge Interest Form"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    Having trouble viewing the embedded form? {" "}
                    <a
                      href="https://forms.gle/uUwgspDN8fQmHjiB6"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-900 underline hover:text-blue-700"
                    >
                      Open it in a new tab
                    </a>
                    .
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Organizers */}
            <TabsContent value="organizers" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-white/60">
                  <CardHeader>
                    <CardTitle>Why partner with MentorMates?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-gray-800">
                    <ul className="list-disc list-inside space-y-2">
                      <li>Structured judging, mentorship, and feedback built-in.</li>
                      <li>Resources that help your participants take projects further.</li>
                      <li>
                        We have recent support from <strong>Stanford</strong> to fund and study
                        hackathons focused on learning and impact.
                      </li>
                      <li>Eligible events can receive budget support and join the research.</li>
                    </ul>
                    <div className="pt-2">
                      <p className="text-sm text-gray-600 mb-2">Supported by:</p>
                      <div className="flex items-center gap-3">
                        <div className="relative w-[180px] h-[60px]">
                          <Link
                            href="https://acceleratelearning.stanford.edu/funding/people-who-help-other-people-learn-pwhopl/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full h-full"
                          >
                            <Image
                              src="https://clinicalmindai.stanford.edu/sites/g/files/sbiybj31566/files/styles/responsive_large/public/media/image/motif_text-stanford_accelerator_for_learning_rgb_1_1.png.webp?itok=b--D-kMe"
                              alt="Stanford Accelerator for Learning"
                              fill
                              className="object-contain opacity-90 hover:opacity-100 transition-opacity duration-300"
                              priority
                            />
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2">
                      <a
                        href="https://forms.gle/R8r3u1uosEswUFE79"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200"
                      >
                        Tell Us About Your Event
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <iframe
                    src="https://forms.gle/R8r3u1uosEswUFE79"
                    className="w-full h-[900px] md:h-[1100px] rounded-md border bg-white"
                    loading="lazy"
                    title="Organizer Interest Form"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    Having trouble viewing the embedded form? {" "}
                    <a
                      href="https://forms.gle/R8r3u1uosEswUFE79"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-900 underline hover:text-blue-700"
                    >
                      Open it in a new tab
                    </a>
                    .
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Careers */}
            <TabsContent value="careers" className="mt-6">
              <div className="grid grid-cols-1">
                <Card className="bg-white/60">
                  <CardHeader>
                    <CardTitle>Join the team</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-gray-800">
                    <p>
                      Help shape the future of AI education. We have flexible, remote‑friendly roles
                      with opportunities to grow.
                    </p>
                    <div>
                      <Link
                        href="/join/hiring"
                        className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200"
                      >
                        See Open Roles
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Contact Card */}
        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Get in touch</h2>
          <p className="text-gray-800 text-md">
            Prefer email? Reach us at{" "}
            <a href="mailto:admin@mentormates.ai" className="text-blue-900 underline hover:text-blue-700">
              admin@mentormates.ai
            </a>
            .
          </p>
        </section>
      </div>

      <div className="pt-10">
        <Footer />
      </div>
    </div>
  );
}

