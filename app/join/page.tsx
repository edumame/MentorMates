import { Footer } from "@/components/layout/footer";

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
        </div>

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
      </div>

      <div className="pt-10">
        <Footer />
      </div>
    </div>
  );
}

