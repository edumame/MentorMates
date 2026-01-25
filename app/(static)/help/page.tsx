import type React from "react";
import Link from "next/link";
import { ArrowRight, Play, PlayCircle } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { TUTORIAL_VIDEOS } from "@/lib/config/tutorials";

const RoleCard: React.FC<{
  title: string;
  description: string;
  href: string;
}> = ({ title, description, href }) => {
  return (
    <Link
      href={href}
      className="group block rounded-xl bg-white border border-gray-100 p-6 shadow-sm transition-all hover:shadow-xl hover:border-[#4B89EF]/20"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            {description}
          </p>
        </div>
        <div className="ml-4 mt-1 shrink-0 rounded-full bg-[#4B89EF]/10 p-3 text-[#4B89EF] transition-all group-hover:bg-[#4B89EF] group-hover:text-white group-hover:translate-x-1">
          <Play className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 inline-flex items-center text-[#4B89EF] font-medium group-hover:underline">
        Watch guide
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
};

const RolesPage: React.FC = () => {
  return (
    <>
      <div className="min-h-screen py-2">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-10 pt-16 pb-16">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-[#4B89EF]/10 px-4 py-1.5 text-[#4B89EF]">
              <PlayCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Video Tutorials</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              Role <span className="text-[#4B89EF]">Guides</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Quick video guides for Participants, Mentors, Judges, and Organizers.
              Learn what each role can do and how to get started.
            </p>
          </div>

          {/* Video Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {TUTORIAL_VIDEOS.map((video) => (
              <RoleCard
                key={video.title}
                title={video.title}
                description={video.description}
                href={video.href}
              />
            ))}
          </div>

          {/* Tips Section */}
          <div className="rounded-xl bg-gradient-to-r from-[#4B89EF] to-[#6B9FEF] p-6 sm:p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">Quick Tips</h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
                <span>Use your role dashboard to find tasks and deadlines.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
                <span>Check event pages for submission timelines and judging criteria.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
                <span>Mentors: leave specific, actionable, and kind feedback.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
                <span>Judges: use the rubric and leave at least one improvement note.</span>
              </li>
            </ul>
          </div>

          {/* Related Links */}
          <div className="text-center space-y-4">
            <p className="text-gray-600">Need more help?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/faq"
                className="text-[#4B89EF] hover:underline font-medium"
              >
                FAQ
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/support"
                className="text-[#4B89EF] hover:underline font-medium"
              >
                Contact Support
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/about"
                className="text-[#4B89EF] hover:underline font-medium"
              >
                About Us
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default RolesPage;
