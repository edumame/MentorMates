import { Footer } from "@/components/layout/Footer";

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
    why: "You'll gain direct access to industry leaders from organizations like Google, Microsoft, Stanford, Johns Hopkins, and more. This is a chance to build your network, sharpen your skills in public speaking and community building, and contribute to the future of AI and education.",
    contact: (
      <>
        🔥 Interested? Reach out to us at{" "}
        <a
          href="mailto:admin@mentormates.ai"
          className="text-[var(--brand-primary-hex)] underline hover:text-[#3367d6] font-medium"
        >
          admin@mentormates.ai
        </a>{" "}
        with a short note about yourself and why you&apos;d be excited to take
        on this role.
      </>
    ),
  },
];

export default function OpportunitiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-16">
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight">
            Join Our{" "}
            <span className="text-[var(--brand-primary-hex)]">
              Team
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-600 leading-relaxed">
            Explore opportunities to help shape the future of AI education and make a meaningful impact.
          </p>
        </div>
        
        {positions.map((role) => (
          <section
            key={role.title}
            className="bg-white border border-gray-200 shadow-sm p-8 rounded-2xl hover:shadow-lg transition-all duration-300 hover:border-[var(--brand-primary-hex)]"
          >
            <div className="space-y-6">
              <div className="border-l-4 border-[var(--brand-primary-hex)] pl-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {role.title}
                </h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--brand-primary-hex)] mb-3 flex items-center">
                    <span className="w-2 h-2 bg-[var(--brand-primary-hex)] rounded-full mr-3"></span>
                    About the Role
                  </h3>
                  <ul className="space-y-2 text-gray-700 leading-relaxed">
                    {role.about.map((item, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-[var(--brand-primary-hex)] mr-3 mt-1.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-[var(--brand-primary-hex)] mb-3 flex items-center">
                    <span className="w-2 h-2 bg-[var(--brand-primary-hex)] rounded-full mr-3"></span>
                    What We&apos;re Looking For
                  </h3>
                  <ul className="space-y-2 text-gray-700 leading-relaxed">
                    {role.lookingFor.map((item, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-[var(--brand-primary-hex)] mr-3 mt-1.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-[var(--brand-primary-hex)] mb-3 flex items-center">
                    <span className="w-2 h-2 bg-[var(--brand-primary-hex)] rounded-full mr-3"></span>
                    Compensation
                  </h3>
                  <ul className="space-y-2 text-gray-700 leading-relaxed">
                    {role.compensation.map((item, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-[var(--brand-primary-hex)] mr-3 mt-1.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[rgb(var(--brand-primary-rgb)/0.05)] p-6 rounded-xl border border-[rgb(var(--brand-primary-rgb)/0.2)]">
                  <h3 className="text-xl font-semibold text-[var(--brand-primary-hex)] mb-3">
                    Why Join Us
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-4">{role.why}</p>
                  <div className="bg-white p-4 rounded-lg border border-[rgb(var(--brand-primary-rgb)/0.3)]">
                    <p className="text-gray-800 leading-relaxed">{role.contact}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
      <Footer />
    </div>
  );
}
