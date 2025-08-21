import { Footer } from "@/components/layout/footer";
import { ArrowRight } from "lucide-react";

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-16">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">
            Join <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">MentorMates</span>
          </h1>
          <p className="max-w-prose mx-auto text-lg text-gray-700">
            Get involved as a mentor, judge, or organizer.
          </p>
          <div className="mt-6">
            <a
              href="/join/hiring"
              className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200"
            >
              We&apos;re Hiring
            </a>
          </div>
        </div>

        {/* Mission */}
        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Our Mission</h2>
          <div className="text-gray-800 text-md space-y-4 text-justify">
            <p>
              We are living in the age of AI, where people feel both excitement and fear. Many want to explore, but also worry about being left behind. Hackathons are one of the best ways to expose people to new technologies, but they often feel intimidating. In just 48 hours, participants are told to “build something,” yet most receive little guidance or scaffolding. This creates a huge barrier to entry—especially for beginners, students from underrepresented backgrounds, and those without prior coding or entrepreneurial experience.
            </p>
            <p>
              The result is that hackathons, which should be gateways to curiosity and innovation, can instead feel exclusive and overwhelming. I&#39;ve seen this first-hand both as a participant and as an organizer. At{' '}
              <a
                href="https://ed.stanford.edu/giving/story/ready-set-solve"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-900 underline hover:text-blue-700"
              >
                Stanford&rsquo;s AI + Learning Differences hackathon
              </a>
              , I focused on showing that hackathons can be about social impact and inclusivity—not just building tech for tech’s sake. What participants valued most was the sense of support, mentorship, and community.
            </p>
            <p>
              MentorMates addresses this gap by making sure every participant gets structured feedback, encouragement, and scaffolding. Our goal is to democratize entrepreneurial education through hackathons, making them more inclusive and accessible. We want hackathons to be spaces where anyone, regardless of background or skill level, can feel confident exploring technology and creating impact.
            </p>
          </div>
        </section>

        {/* Contact Card */}
        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Get in touch</h2>
          <p className="text-gray-800 text-md">
            Prefer email? Reach us at{' '}
            <a href="mailto:admin@mentormates.ai" className="text-blue-900 underline hover:text-blue-700">
              admin@mentormates.ai
            </a>
            .
          </p>
        </section>

        {/* Mentors & Judges */}
        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Mentors &amp; Judges</h2>
          <p className="text-gray-800 text-md mb-4">
            Interested in mentoring or judging? Please fill out the form below so we can get in touch.
          </p>
          <div>
            <iframe
              src="https://forms.gle/uUwgspDN8fQmHjiB6"
              className="w-full h-[900px] md:h-[1100px] rounded-md border"
              loading="lazy"
              title="Mentor & Judge Interest Form"
            />
            <p className="mt-4 text-sm text-gray-600">
              Having trouble viewing the embedded form?{' '}
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
        </section>

        {/* Organizers */}
        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Organizers</h2>
          <p className="text-gray-800 text-md mb-4">
            Organizing an event and want MentorMates involved? Fill out this form and we&apos;ll reach out.
          </p>
          <div>
            <iframe
              src="https://forms.gle/R8r3u1uosEswUFE79"
              className="w-full h-[900px] md:h-[1100px] rounded-md border"
              loading="lazy"
              title="Organizer Interest Form"
            />
            <p className="mt-4 text-sm text-gray-600">
              Having trouble viewing the embedded form?{' '}
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
        </section>

        {/* DevPost Integration */}
        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Already Using DevPost?</h2>
          <p className="text-gray-800 text-md mb-4">
            Hey, are you already using DevPost? If you are, look at this DevPost integration.
          </p>
          <p className="text-gray-700 text-sm mb-4">
            MentorMates seamlessly integrates with DevPost to enhance your hackathon with structured feedback, 
            mentorship connections, and engagement analytics - all while keeping your familiar DevPost workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/devpost-integration"
              className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200 text-center justify-center"
            >
              Learn About DevPost Integration
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="mailto:admin@mentormates.ai?subject=DevPost Integration Inquiry"
              className="inline-flex items-center px-4 py-2 border border-blue-900 text-blue-900 rounded-md hover:bg-blue-50 transition-colors duration-200 text-center justify-center"
            >
              Contact Us About Integration
            </a>
          </div>
        </section>
      </div>

      <div className="pt-10">
        <Footer />
      </div>
    </div>
  );
}

