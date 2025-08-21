import type React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Users, Mic, Heart, Globe, DollarSign, Clock, MapPin } from "lucide-react";
import { Footer } from '@/components/layout/footer';

const CareersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-16">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">
            Join Our{" "}
            <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">
              Team
            </span>
          </h1>
          <p className="max-w-prose mx-auto text-lg text-gray-700">
            Help us build the future of AI-powered education and community engagement.
          </p>
        </div>

        {/* Job Posting */}
        <div className="bg-white/70 shadow-lg p-8 rounded-xl transition-shadow hover:shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-full">
              <Mic className="h-6 w-6 text-blue-900" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Podcast Host &amp; Community Engagement Lead
              </h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>Remote-friendly</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Flexible schedule</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  <span>$500 HKD per episode</span>
                </div>
              </div>
            </div>
          </div>

          <div className="prose max-w-none">
            <p className="text-gray-800 text-lg mb-6">
              We&apos;re looking for an energetic, curious, and community-driven individual to host and run our upcoming podcast series and support our community engagement efforts.
            </p>

            {/* About the Role */}
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-900" />
                About the Role
              </h3>
              <p className="text-gray-800 mb-4">
                As the Podcast Host &amp; Community Engagement Lead, you&apos;ll:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Co-host a podcast series with our founder, featuring conversations with leading voices in AI, education, and technology.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Take ownership of outreach, preparation, and logistics for each episode.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Research guest speakers, draft guiding questions, and drive engaging conversations.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Support community events, workshops, and collaborations with universities and partners.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Help build transparency and foster meaningful engagement across our community.</span>
                </li>
              </ul>
            </section>

            {/* What We're Looking For */}
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Heart className="h-6 w-6 text-blue-900" />
                What We&apos;re Looking For
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span><strong>Strong communication and hosting presence</strong> (comfortable leading conversations).</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span><strong>Interest in AI, education, and entrepreneurship.</strong></span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span><strong>Experience in community building, event organizing, or media production</strong> is a plus.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span><strong>Highly organized, reliable, and proactive.</strong></span>
                </li>
              </ul>
            </section>

            {/* Compensation */}
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-blue-900" />
                Compensation
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span><strong>$500 HKD per episode</strong> (with opportunities for growth as the program expands).</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span><strong>Flexible, remote-friendly role.</strong></span>
                </li>
              </ul>
            </section>

            {/* Why Join Us */}
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="h-6 w-6 text-blue-900" />
                Why Join Us
              </h3>
              <p className="text-gray-800 mb-4">
                You&apos;ll gain direct access to industry leaders from organizations like <strong>Anthropic</strong>, <strong>Stanford</strong>, <strong>Johns Hopkins</strong>, and more. This is a chance to:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Build your network with leading voices in AI and education</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Sharpen your skills in public speaking and community building</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Contribute to the future of AI and education</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-blue-900 flex-shrink-0 mt-1 mr-3" />
                  <span>Work with a passionate team dedicated to improving learning outcomes</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Call to Action */}
          <div className="mt-10 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
            <h4 className="text-xl font-bold text-gray-900 mb-3">Ready to Apply?</h4>
            <p className="text-gray-700 mb-4">
              Interested? Reach out to us with a short note about yourself and why you&apos;d be excited to take on this role.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="mailto:team@mentormates.com?subject=Podcast Host Application&body=Hi! I'm interested in the Podcast Host & Community Engagement Lead position. Here's a bit about myself:%0A%0A[Tell us about your background, experience, and why you're excited about this role]"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-900 hover:bg-blue-800 transition-colors duration-300 transform hover:scale-105"
              >
                Apply Now
                <ArrowRight className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-6 py-3 border border-blue-900 text-base font-medium rounded-md text-blue-900 bg-transparent hover:bg-blue-50 transition-colors duration-300"
              >
                Learn More About Us
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">About MentorMates</h3>
          <p className="text-gray-800 mb-4">
            MentorMates is at the forefront of exploring how generative AI can enhance formative feedback in educational contexts. Our platform focuses on hackathons and project-based learning, investigating the intersection of AI and pedagogy to develop solutions that scale high-quality mentorship while maintaining the human touch that makes feedback impactful.
          </p>
          <p className="text-gray-800">
            Join us in building the future of AI-powered education and help us create meaningful connections between technology, learning, and community.
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-16">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-900 hover:bg-gray-800 transition-colors duration-300 transform hover:scale-105"
          >
            Back to Home
            <ArrowRight className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      
      <div className="pt-10">
        <Footer />    
      </div>
    </div>
  );
};

export default CareersPage;
