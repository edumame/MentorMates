import type React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle,
  Users,
  FileText,
  Shield,
  Award,
  BarChart3,
  Play,
} from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { VideoEmbed } from "@/components/utils/VideoEmbed";
import { VIDEO_SOURCES } from "@/lib/config/video-sources";

const FeatureStep: React.FC<{
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = ({ number, title, description, icon }) => {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-900">
          {icon}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-900 text-xs font-bold text-white">
            {number}
          </span>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-700 leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

const BenefitCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
}> = ({ title, description, icon }) => {
  return (
    <div className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-700">{description}</p>
    </div>
  );
};

const DevpostIntegrationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-16">
        {/* Header Section */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-blue-900">
                MentorMates
              </div>
              <span className="text-gray-400 text-2xl">×</span>
              <Image
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDoVbDqO8NGA73bz-BIDZstUea7bFlCFs17A&s"
                alt="Devpost Logo"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">
            MentorMates × Devpost{" "}
            <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">
              Integration
            </span>
          </h1>
          <p className="max-w-prose mx-auto text-lg text-gray-700">
            Seamless feedback on top of Devpost. MentorMates works alongside
            Devpost to give hackathon organizers, mentors, judges, and
            participants a streamlined way to share and receive feedback.
          </p>
        </div>

        {/* Key Value Proposition */}
        <div className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Why It Matters
          </h2>
          <p className="text-gray-800 text-md">
            With MentorMates, Devpost becomes more than just a submission
            portal—it becomes a full feedback ecosystem. Organizers maintain
            their familiar Devpost process, while participants gain actionable
            input to grow their skills, and mentors/judges have structured ways
            to engage meaningfully.
          </p>
        </div>

        {/* How It Works Section */}
        <section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
            <div className="space-y-8">
              <FeatureStep
                number="1"
                title="Devpost Data Import"
                description="Organizers export participant and project data directly from Devpost. MentorMates automatically imports this data, including participant emails and project links, to set up event profiles."
                icon={<FileText className="h-5 w-5" />}
              />

              <FeatureStep
                number="2"
                title="Feedback Assignment & Delivery"
                description="MentorMates connects mentors and judges to projects using Devpost submission data. Each participant automatically receives a feedback QR code tied to their Devpost project. Participants can also be prompted to review at least 3 peer projects, ensuring a culture of constructive feedback."
                icon={<Users className="h-5 w-5" />}
              />

              <FeatureStep
                number="3"
                title="Moderation & Safety"
                description="Feedback is filtered to prevent spam, negativity, or rule violations, aligning with MLH and event guidelines. Organizers can monitor feedback activity and ensure fairness."
                icon={<Shield className="h-5 w-5" />}
              />
            </div>

            <div className="space-y-8">
              <FeatureStep
                number="4"
                title="Incentives & Engagement"
                description="Organizers can tie feedback completion to event incentives (e.g., custom stickers, sponsor prizes). This drives higher engagement while keeping Devpost as the primary submission platform."
                icon={<Award className="h-5 w-5" />}
              />

              <FeatureStep
                number="5"
                title="Post-Event Insights"
                description="MentorMates generates analytics on participation, judging, and feedback trends. Organizers get a clearer picture of what worked and where participants need more support, enhancing the impact of Devpost submissions."
                icon={<BarChart3 className="h-5 w-5" />}
              />

              {/* Organizer Demo Video */}
              <div className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Play className="h-5 w-5 text-blue-900" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Organizer Demo
                  </h3>
                </div>
                <VideoEmbed
                  url={VIDEO_SOURCES.organizer.url}
                  title="MentorMates Organizer Demo"
                  className="rounded-lg overflow-hidden"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Grid */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Key Benefits
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <BenefitCard
              title="No Learning Curve"
              description="Since most hackathons already rely on Devpost for project submissions, MentorMates plugs directly into this workflow without requiring students or organizers to learn a new system."
              icon={<CheckCircle className="h-6 w-6 text-blue-900" />}
            />

            <BenefitCard
              title="Enhanced Engagement"
              description="Transform passive project submissions into active feedback exchanges, creating a more collaborative and educational hackathon experience."
              icon={<Users className="h-6 w-6 text-blue-900" />}
            />

            <BenefitCard
              title="Quality Assurance"
              description="Built-in moderation ensures all feedback aligns with MLH guidelines and maintains a positive, constructive environment."
              icon={<Shield className="h-6 w-6 text-blue-900" />}
            />

            <BenefitCard
              title="Data-Driven Insights"
              description="Get comprehensive analytics on participation patterns, feedback quality, and event success metrics to improve future hackathons."
              icon={<BarChart3 className="h-6 w-6 text-blue-900" />}
            />

            <BenefitCard
              title="Seamless Integration"
              description="Works with your existing Devpost workflow - no disruption to organizers or participants, just enhanced functionality."
              icon={<ArrowRight className="h-6 w-6 text-blue-900" />}
            />

            <BenefitCard
              title="Incentive System"
              description="Drive participation through customizable rewards and recognition systems tied to meaningful feedback contributions."
              icon={<Award className="h-6 w-6 text-blue-900" />}
            />
          </div>
        </section>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <Link
            href="/roles"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-900 hover:bg-gray-800 transition-colors duration-300 transform hover:scale-105"
          >
            Learn About Roles
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

export default DevpostIntegrationPage;
