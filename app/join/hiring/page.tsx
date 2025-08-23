import { Footer } from "@/components/layout/footer";

const positions = [
  {
    title: "Podcast Host & Community Engagement Lead",
    about: [
      "Co-host a podcast series with our founder, featuring conversations with leading voices in AI, education, and technology.",
      "Take ownership of outreach, preparation, and logistics for each episode.",
      "Research guest speakers, draft guiding questions, and drive engaging conversations.",
      "Support community events, workshops, and collaborations with universities and partners.",
      "Help build transparency and foster meaningful engagement across our community.",
    ],
    lookingFor: [
      "Strong communication and hosting presence (comfortable leading conversations).",
      "Interest in AI, education, and entrepreneurship.",
      "Experience in community building, event organizing, or media production is a plus.",
      "Highly organized, reliable, and proactive.",
    ],
    compensation: [
      "Per-episode compensation with opportunities for growth as the program expands.",
      "Flexible, remote-friendly role.",
    ],
    why:
      "You'll gain direct access to industry leaders from organizations like Google, Microsoft, Stanford, Johns Hopkins, and more. This is a chance to build your network, sharpen your skills in public speaking and community building, and contribute to the future of AI and education.",
    contact: (
      <>
        \uD83D\uDC49 Interested? Reach out to us at{' '}
        <a
          href="mailto:admin@mentormates.ai"
          className="text-blue-900 underline hover:text-blue-700"
        >
          admin@mentormates.ai
        </a>{' '}
        with a short note about yourself and why you&apos;d be excited to take on this role.
      </>
    ),
  },
];

export default function HiringPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">
            We&apos;re Hiring
          </h1>
          <p className="max-w-prose mx-auto text-lg text-gray-700">
            Join our team and help shape the future of AI education.
          </p>
        </div>
        {positions.map((role) => (
          <section
            key={role.title}
            className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{role.title}</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">About the Role</h3>
            <ul className="list-disc list-inside text-gray-800 mb-4 space-y-1">
              {role.about.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">What We&apos;re Looking For</h3>
            <ul className="list-disc list-inside text-gray-800 mb-4 space-y-1">
              {role.lookingFor.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Compensation</h3>
            <ul className="list-disc list-inside text-gray-800 mb-4 space-y-1">
              {role.compensation.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Why Join Us</h3>
            <p className="text-gray-800 mb-4">{role.why}</p>
            <p className="text-gray-800">{role.contact}</p>
          </section>
        ))}
      </div>
      <div className="pt-10">
        <Footer />
      </div>
    </div>
  );
}

