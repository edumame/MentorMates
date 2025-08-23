import { Footer } from "@/components/layout/footer";
import Link from "next/link";
import { ArrowRight, Users, Award, Calendar, Briefcase, CheckCircle } from "lucide-react";
import Image from "next/image";

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">
            Join <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">MentorMates</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-700">
            Be part of the movement to democratize entrepreneurial education through inclusive hackathons
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* Employees Card */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-t-4 border-blue-900">
            <div className="flex items-center mb-4">
              <Briefcase className="h-8 w-8 text-blue-900 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Join Our Team</h3>
            </div>
            <p className="text-gray-600 mb-4">
              We're building the future of inclusive hackathons and looking for passionate individuals to join us.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Work on cutting-edge EdTech</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Stanford-backed innovation</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Remote-friendly culture</span>
              </li>
            </ul>
            <Link
              href="/join/hiring"
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200"
            >
              View Open Positions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          {/* Mentors & Judges Card */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-t-4 border-green-600">
            <div className="flex items-center mb-4">
              <Award className="h-8 w-8 text-green-600 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Mentor or Judge</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Share your expertise and guide the next generation of innovators.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Support O-1 & EB-1A visa applications</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Build your professional portfolio</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Network with industry leaders</span>
              </li>
            </ul>
            <a
              href="#mentors-judges"
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('mentors-judges')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Become a Mentor
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>

          {/* Organizers Card */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-t-4 border-purple-600">
            <div className="flex items-center mb-4">
              <Calendar className="h-8 w-8 text-purple-600 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Event Organizer</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Enhance your hackathon with our platform and support.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Stanford grant funding available</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Join Stanford research program</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Free platform & mentorship tools</span>
              </li>
            </ul>
            <a
              href="#organizers"
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('organizers')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Partner With Us
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Mission Section */}
        <section className="bg-white/90 backdrop-blur shadow-lg p-8 rounded-xl mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Our Mission</h2>
          <div className="text-gray-800 text-lg space-y-4 max-w-4xl mx-auto">
            <p>
              We are living in the age of AI, where people feel both excitement and fear. Many want to explore, but also worry about being left behind. Hackathons are one of the best ways to expose people to new technologies, but they often feel intimidating.
            </p>
            <p>
              At{' '}
              <a
                href="https://ed.stanford.edu/giving/story/ready-set-solve"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-900 underline hover:text-blue-700"
              >
                Stanford's AI + Learning Differences hackathon
              </a>
              , we showed that hackathons can be about social impact and inclusivity—not just building tech for tech's sake. What participants valued most was the sense of support, mentorship, and community.
            </p>
            <p className="font-semibold text-center text-xl text-blue-900 pt-4">
              MentorMates democratizes entrepreneurial education through hackathons, making them inclusive and accessible for everyone.
            </p>
          </div>
        </section>

        {/* Mentors & Judges Section */}
        <section id="mentors-judges" className="bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg p-8 rounded-xl mb-12 scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Become a Mentor or Judge</h2>
              <p className="text-lg text-gray-700 mb-6">
                Share your expertise and make a lasting impact on emerging innovators
              </p>
              <div className="bg-white/80 backdrop-blur rounded-lg p-6 mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Why Join as a Mentor/Judge?</h3>
                <div className="grid md:grid-cols-2 gap-4 text-left">
                  <div className="flex items-start">
                    <Award className="h-6 w-6 text-green-600 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">Visa Support Documentation</p>
                      <p className="text-sm text-gray-600">Build evidence for O-1 and EB-1A visa applications through documented mentorship and judging roles</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Users className="h-6 w-6 text-green-600 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">Professional Recognition</p>
                      <p className="text-sm text-gray-600">Get featured as an expert in your field and expand your professional network</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <iframe
                src="https://forms.gle/uUwgspDN8fQmHjiB6"
                className="w-full h-[900px] md:h-[1100px] rounded-md border bg-white"
                loading="lazy"
                title="Mentor & Judge Interest Form"
              />
              <p className="mt-4 text-sm text-gray-600 text-center">
                Having trouble viewing the form?{' '}
                <a
                  href="https://forms.gle/uUwgspDN8fQmHjiB6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  Open it in a new tab
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Organizers Section */}
        <section id="organizers" className="bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg p-8 rounded-xl mb-12 scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Partner as an Event Organizer</h2>
              <p className="text-lg text-gray-700 mb-6">
                Let MentorMates enhance your hackathon with funding, tools, and research support
              </p>
              
              {/* Stanford Badge */}
              <div className="bg-white/90 backdrop-blur rounded-lg p-6 mb-8">
                <div className="flex flex-col items-center mb-6">
                  <p className="text-sm text-gray-600 mb-3">Supported by</p>
                  <div className="relative h-16 w-64">
                    <Image
                      src="https://clinicalmindai.stanford.edu/sites/g/files/sbiybj31566/files/styles/responsive_large/public/media/image/motif_text-stanford_accelerator_for_learning_rgb_1_1.png.webp?itok=b--D-kMe"
                      alt="Stanford Accelerator for Learning"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Stanford Grant Program</h3>
                <div className="grid md:grid-cols-2 gap-4 text-left">
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-purple-600 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">Funding Support</p>
                      <p className="text-sm text-gray-600">Access Stanford grants to support your hackathon and help participants take projects further</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-purple-600 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">Research Partnership</p>
                      <p className="text-sm text-gray-600">Contribute to Stanford research on inclusive entrepreneurial education</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-purple-600 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">Platform & Tools</p>
                      <p className="text-sm text-gray-600">Free access to MentorMates platform with structured feedback and mentorship tools</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-purple-600 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">Post-Hackathon Support</p>
                      <p className="text-sm text-gray-600">Help teams continue developing their projects beyond the event</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <iframe
                src="https://forms.gle/R8r3u1uosEswUFE79"
                className="w-full h-[900px] md:h-[1100px] rounded-md border bg-white"
                loading="lazy"
                title="Organizer Interest Form"
              />
              <p className="mt-4 text-sm text-gray-600 text-center">
                Having trouble viewing the form?{' '}
                <a
                  href="https://forms.gle/R8r3u1uosEswUFE79"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  Open it in a new tab
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* DevPost Integration */}
        <section className="bg-gradient-to-r from-blue-50 to-cyan-50 shadow-lg p-8 rounded-xl mb-12">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Already Using DevPost?</h2>
            <p className="text-lg text-gray-700 mb-6">
              Seamlessly integrate MentorMates with your existing DevPost workflow
            </p>
            <div className="bg-white/80 backdrop-blur rounded-lg p-6 mb-6">
              <p className="text-gray-700 mb-6">
                Keep your familiar DevPost submission process while adding structured feedback, 
                mentorship connections, and engagement analytics that make your hackathon more inclusive and impactful.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/devpost-integration"
                  className="inline-flex items-center justify-center px-6 py-3 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200"
                >
                  Learn About Integration
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <a
                  href="mailto:admin@mentormates.ai?subject=DevPost Integration Inquiry"
                  className="inline-flex items-center justify-center px-6 py-3 border-2 border-blue-900 text-blue-900 rounded-md hover:bg-blue-50 transition-colors duration-200"
                >
                  Contact Our Team
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="bg-white/90 backdrop-blur shadow-lg p-8 rounded-xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Have Questions?</h2>
          <p className="text-lg text-gray-700 mb-2">
            We're here to help! Reach out to us at
          </p>
          <a href="mailto:admin@mentormates.ai" className="text-xl text-blue-900 underline hover:text-blue-700 font-semibold">
            admin@mentormates.ai
          </a>
        </section>
      </div>

      <Footer />
    </div>
  );
}