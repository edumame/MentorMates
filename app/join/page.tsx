export default function JoinPage() {
  return (
    <div className="min-h-screen">
      {/* Gradient Hero */}
      <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Join MentorMates</h1>
          <p className="mt-4 text-lg md:text-xl text-blue-50/90">
            Get involved as a mentor, judge, or organizer. We would love to have you!
          </p>
          <a
            href="mailto:admin@mentormates.ai"
            className="inline-block mt-6 rounded-full px-6 py-3 text-sm font-semibold ring-1 ring-white/30 bg-white/10 hover:bg-white/20 transition"
          >
            Reach out via email: admin@mentormates.ai
          </a>
        </div>
      </section>

      {/* Forms */}
      <main className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {/* Mentor/Judges */}
        <section>
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Mentors & Judges</h2>
            <p className="mt-2 text-gray-600">
              Interested in mentoring or judging? Please fill out the form below so we can get in touch.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
            <div className="p-4 md:p-6">
              <div className="aspect-[3/4] w-full">
                <iframe
                  src="https://forms.gle/uUwgspDN8fQmHjiB6"
                  className="w-full h-[900px] md:h-[1100px] rounded-md border"
                  loading="lazy"
                  title="Mentor & Judge Interest Form"
                />
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Having trouble viewing the embedded form?{' '}
                <a
                  href="https://forms.gle/uUwgspDN8fQmHjiB6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open it in a new tab
                </a>
                .
              </div>
            </div>
          </div>
        </section>

        {/* Organizers */}
        <section>
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Organizers</h2>
            <p className="mt-2 text-gray-600">
              Organizing an event and want MentorMates involved? Fill out this form and we&apos;ll reach out.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
            <div className="p-4 md:p-6">
              <div className="aspect-[3/4] w-full">
                <iframe
                  src="https://forms.gle/R8r3u1uosEswUFE79"
                  className="w-full h-[900px] md:h-[1100px] rounded-md border"
                  loading="lazy"
                  title="Organizer Interest Form"
                />
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Having trouble viewing the embedded form?{' '}
                <a
                  href="https://forms.gle/R8r3u1uosEswUFE79"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open it in a new tab
                </a>
                .
              </div>
            </div>
          </div>
        </section>

        {/* Email fallback */}
        <section className="pt-4">
          <p className="text-sm text-gray-600">
            Prefer email? Contact us at{' '}
            <a href="mailto:admin@mentormates.ai" className="text-blue-600 hover:underline">
              admin@mentormates.ai
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}

