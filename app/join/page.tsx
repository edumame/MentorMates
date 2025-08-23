import { Footer } from "@/components/layout/footer";
import Link from "next/link";
import { ArrowRight, Briefcase, Users, Calendar, Award, Globe } from "lucide-react";

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-16">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">
            Join <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">MentorMates</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-700 mb-8">
            Choose how you want to contribute to the future of AI education and entrepreneurship.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Career Opportunities */}
          <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl p-8 transition-all hover:shadow-2xl hover:scale-105 border border-blue-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Briefcase className="h-8 w-8 text-blue-900" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Work With Us</h3>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Join our team and help shape the future of AI education. We're building the next generation of inclusive hackathon experiences.
              </p>
              <div className="space-y-3">
                <Link
                  href="/join/hiring"
                  className="block w-full bg-blue-900 text-white py-3 px-6 rounded-lg hover:bg-blue-800 transition-colors duration-200 font-semibold"
                >
                  View Open Positions
                </Link>
                <p className="text-sm text-gray-600">
                  Full-time and part-time opportunities available
                </p>
              </div>
            </div>
          </div>

          {/* Mentors & Judges */}
          <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl p-8 transition-all hover:shadow-2xl hover:scale-105 border border-purple-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-purple-900" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Mentor & Judge</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Guide the next generation of innovators and help participants turn their ideas into reality.
              </p>
              
              {/* Visa Benefits */}
              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center mb-2">
                  <Globe className="h-5 w-5 text-purple-700 mr-2" />
                  <span className="font-semibold text-purple-900">Visa Support</span>
                </div>
                <p className="text-sm text-purple-800">
                  Mentoring and judging activities can support <strong>O-1 and EB-1A visa applications</strong> by demonstrating extraordinary ability and contributions to your field.
                </p>
              </div>

              <div className="space-y-3">
                <a
                  href="#mentor-form"
                  className="block w-full bg-purple-900 text-white py-3 px-6 rounded-lg hover:bg-purple-800 transition-colors duration-200 font-semibold"
                >
                  Apply to Mentor/Judge
                </a>
                <p className="text-sm text-gray-600">
                  Flexible time commitment • Remote friendly
                </p>
              </div>
            </div>
          </div>

          {/* Organizers */}
          <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl p-8 transition-all hover:shadow-2xl hover:scale-105 border border-green-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-8 w-8 text-green-900" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Partner With Us</h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Bring MentorMates to your hackathon and provide participants with structured mentorship and feedback.
              </p>

              {/* Stanford Grant */}
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center mb-2">
                  <Award className="h-5 w-5 text-green-700 mr-2" />
                  <span className="font-semibold text-green-900">Grant Support</span>
                </div>
                <p className="text-sm text-green-800">
                  We recently received a grant from <strong>Stanford</strong> to support hackathons and help participants take their projects further. Plus, become part of Stanford research on AI education.
                </p>
              </div>

              <div className="space-y-3">
                <a
                  href="#organizer-form"
                  className="block w-full bg-green-900 text-white py-3 px-6 rounded-lg hover:bg-green-800 transition-colors duration-200 font-semibold"
                >
                  Partner With Us
                </a>
                <p className="text-sm text-gray-600">
                  Funding available • Research participation
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mission */}
        <section className="bg-white/70 shadow-lg p-8 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Our Mission</h2>
          <div className="text-gray-800 text-md space-y-4 leading-relaxed max-w-4xl mx-auto">
            <p>
              We are living in the age of AI, where people feel both excitement and fear. Many want to explore, but also worry about being left behind. Hackathons are one of the best ways to expose people to new technologies, but they often feel intimidating. In just 48 hours, participants are told to "build something," yet most receive little guidance or scaffolding. This creates a huge barrier to entry—especially for beginners, students from underrepresented backgrounds, and those without prior coding or entrepreneurial experience.
            </p>
            <p>
              The result is that hackathons, which should be gateways to curiosity and innovation, can instead feel exclusive and overwhelming. I&#39;ve seen this first-hand both as a participant and as an organizer. At{' '}
              <a
                href="https://ed.stanford.edu/giving/story/ready-set-solve"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-900 underline hover:text-blue-700 font-semibold"
              >
                Stanford&rsquo;s AI + Learning Differences hackathon
              </a>
              , I focused on showing that hackathons can be about social impact and inclusivity—not just building tech for tech's sake. What participants valued most was the sense of support, mentorship, and community.
            </p>
            <p>
              MentorMates addresses this gap by making sure every participant gets structured feedback, encouragement, and scaffolding. Our goal is to democratize entrepreneurial education through hackathons, making them more inclusive and accessible. We want hackathons to be spaces where anyone, regardless of background or skill level, can feel confident exploring technology and creating impact.
            </p>
          </div>
        </section>

        {/* Application Forms */}
        <div className="space-y-12">
          {/* Mentors & Judges Form */}
          <section id="mentor-form" className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-purple-900" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Apply to Mentor & Judge</h2>
              <p className="text-gray-800 text-md mb-4 max-w-2xl mx-auto">
                Share your expertise and help participants turn their ideas into reality. Your contributions can also support visa applications by demonstrating extraordinary ability in your field.
              </p>
            </div>
            <div>
              <iframe
                src="https://forms.gle/uUwgspDN8fQmHjiB6"
                className="w-full h-[900px] md:h-[1100px] rounded-md border"
                loading="lazy"
                title="Mentor & Judge Interest Form"
              />
              <p className="mt-4 text-sm text-gray-600 text-center">
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

          {/* Organizers Form */}
          <section id="organizer-form" className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-green-900" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Partner With MentorMates</h2>
              <p className="text-gray-800 text-md mb-4 max-w-2xl mx-auto">
                Bring structured mentorship to your hackathon. With our Stanford grant, we can provide funding support and include your event in our research on AI education impact.
              </p>
              <div className="inline-flex items-center bg-green-50 px-4 py-2 rounded-full mb-4">
                <Award className="h-4 w-4 text-green-700 mr-2" />
                <span className="text-sm font-semibold text-green-900">Supported by Stanford Research</span>
              </div>
            </div>
            <div>
              <iframe
                src="https://forms.gle/R8r3u1uosEswUFE79"
                className="w-full h-[900px] md:h-[1100px] rounded-md border"
                loading="lazy"
                title="Organizer Interest Form"
              />
              <p className="mt-4 text-sm text-gray-600 text-center">
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

        {/* DevPost Integration */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-lg p-8 rounded-xl transition-shadow hover:shadow-2xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Already Using DevPost?</h2>
            <p className="text-gray-800 text-md mb-4 max-w-3xl mx-auto">
              MentorMates seamlessly integrates with DevPost to enhance your hackathon with structured feedback, 
              mentorship connections, and engagement analytics - all while keeping your familiar DevPost workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/devpost-integration"
                className="inline-flex items-center px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors duration-200 font-semibold"
              >
                Learn About DevPost Integration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a
                href="mailto:admin@mentormates.ai?subject=DevPost Integration Inquiry"
                className="inline-flex items-center px-6 py-3 border border-blue-900 text-blue-900 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-semibold"
              >
                Contact Us About Integration
              </a>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="bg-white/70 shadow-lg p-8 rounded-xl transition-shadow hover:shadow-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions? Get in Touch</h2>
          <p className="text-gray-800 text-md mb-6 max-w-2xl mx-auto">
            Have questions about joining MentorMates or want to learn more about our programs? We'd love to hear from you.
          </p>
          <div className="space-y-4">
            <p className="text-gray-700">
              Reach us at{' '}
              <a 
                href="mailto:admin@mentormates.ai" 
                className="text-blue-900 underline hover:text-blue-700 font-semibold"
              >
                admin@mentormates.ai
              </a>
            </p>
            <p className="text-sm text-gray-600">
              We typically respond within 24 hours
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

