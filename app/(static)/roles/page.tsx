import type React from "react";
import Link from "next/link";
import { ArrowRight, HelpCircle, Play } from "lucide-react";
import { Footer } from "@/components/layout/footer";

const RoleCard: React.FC<{
  title: string;
  description: string;
  href: string;
}> = ({ title, description, href }) => {
  return (
    <Link
      href={href}
      className="group block rounded-xl bg-white/70 p-6 shadow-lg transition-all hover:shadow-2xl hover:bg-white"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-blue-900">{title}</h3>
          <p className="mt-2 text-gray-700 text-sm leading-relaxed">{description}</p>
        </div>
        <div className="ml-4 mt-1 shrink-0 rounded-full bg-blue-50 p-3 text-blue-900 transition-transform group-hover:translate-x-1">
          <Play className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 inline-flex items-center text-blue-900 font-medium">
        Watch guide
        <ArrowRight className="ml-1 h-4 w-4" />
      </div>
    </Link>
  );
};

const RolesPage: React.FC = () => {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-10 pt-16">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-900">
            <HelpCircle className="h-4 w-4" />
            <span className="text-sm font-medium">How to use MentorMates</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight">
            Navigate Roles in <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">MentorMates</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-700">
            Quick guides for Participants, Mentors, Judges, and Organizers. Learn what each role can do and how to get started.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <RoleCard
            title="Participant"
            description="Submit projects, share ideas, and get real feedback from mentors and judges."
            href="https://youtu.be/mAm-LnMK5dA"
          />
          <RoleCard
            title="Mentor"
            description="Support participants with actionable, encouraging feedback that helps them grow."
            href="https://youtu.be/mAm-LnMK5dA"
          />
          <RoleCard
            title="Judge"
            description="Review projects, score fairly, and provide constructive feedback."
            href="https://youtu.be/o1iCt7qE5UY"
          />
          <RoleCard
            title="Organizer"
            description="Manage events: set up submissions, assign mentors/judges, and configure parameters."
            href="https://youtu.be/DFGjGusKtdo"
          />
        </div>

        <div className="rounded-xl bg-white/70 p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-blue-900">Tips</h2>
          <ul className="mt-3 list-disc pl-5 text-gray-700">
            <li>Use your role dashboard to find tasks and deadlines.</li>
            <li>Check event pages for submission timelines and judging criteria.</li>
            <li>Mentors: leave specific, actionable, and kind feedback.</li>
            <li>Judges: use the rubric and leave at least one improvement note.</li>
          </ul>
          <div className="mt-4">
            <Link href="/about" className="text-blue-900 underline hover:text-blue-700">Learn more about MentorMates</Link>
          </div>
        </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default RolesPage;