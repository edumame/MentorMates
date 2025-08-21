"use client";

import { motion } from "framer-motion";
import { JobCard } from "@/components/careers/JobCard";
import { JobPosting, CareerPageData } from "@/lib/types/careers";
import { Badge } from "@/components/ui/badge";
import { Users, Lightbulb, Globe, Heart } from "lucide-react";

// Sample job data including the podcast host position
const jobPostings: JobPosting[] = [
  {
    id: "podcast-host-2024",
    title: "Podcast Host & Community Engagement Lead",
    department: "Marketing & Community",
    location: "Remote",
    type: "part-time",
    remote: true,
    salary: {
      min: 500,
      max: 500,
      currency: "HKD",
      period: "per-episode"
    },
    description: "We're looking for an energetic, curious, and community-driven individual to host and run our upcoming podcast series and support our community engagement efforts. You'll co-host a podcast series with our founder, featuring conversations with leading voices in AI, education, and technology.",
    responsibilities: [
      "Co-host a podcast series with our founder, featuring conversations with leading voices in AI, education, and technology",
      "Take ownership of outreach, preparation, and logistics for each episode",
      "Research guest speakers, draft guiding questions, and drive engaging conversations",
      "Support community events, workshops, and collaborations with universities and partners",
      "Help build transparency and foster meaningful engagement across our community"
    ],
    requirements: [
      "Strong communication and hosting presence (comfortable leading conversations)",
      "Interest in AI, education, and entrepreneurship",
      "Highly organized, reliable, and proactive"
    ],
    qualifications: [
      "Experience in community building, event organizing, or media production is a plus",
      "Comfortable with public speaking and interview formats",
      "Passion for connecting with industry leaders and thought leaders"
    ],
    benefits: [
      "Direct access to industry leaders from organizations like Anthropic, Stanford, Johns Hopkins, and more",
      "Opportunity to build your network and sharpen your skills in public speaking",
      "Contribute to the future of AI and education",
      "Flexible, remote-friendly role with growth opportunities"
    ],
    postedDate: "2024-12-19",
    applicationDeadline: "2025-01-31",
    contactEmail: "careers@mentormates.com",
    isActive: true
  }
];

const companyValues = [
  {
    title: "Innovation in Education",
    description: "We're building the future of mentorship and learning through technology and human connection.",
    icon: "lightbulb"
  },
  {
    title: "Global Community",
    description: "Connecting mentors and learners across the world to create meaningful educational experiences.",
    icon: "globe"
  },
  {
    title: "Collaborative Growth",
    description: "We believe in growing together, supporting each other, and building something meaningful.",
    icon: "users"
  },
  {
    title: "Purpose-Driven Work",
    description: "Every role at MentorMates contributes to empowering the next generation of innovators.",
    icon: "heart"
  }
];

const iconMap = {
  lightbulb: Lightbulb,
  globe: Globe,
  users: Users,
  heart: Heart
};

export default function CareersPage() {
  const activeJobs = jobPostings.filter(job => job.isActive);
  const inactiveJobs = jobPostings.filter(job => !job.isActive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
              Join Our Mission
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Help us build the future of mentorship and education. Join a team that's connecting 
              mentors and learners worldwide through innovative technology and meaningful experiences.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Badge variant="outline" className="px-4 py-2 text-lg bg-blue-50 text-blue-700 border-blue-200">
                {activeJobs.length} Open Position{activeJobs.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline" className="px-4 py-2 text-lg bg-green-50 text-green-700 border-green-200">
                Remote-First Culture
              </Badge>
              <Badge variant="outline" className="px-4 py-2 text-lg bg-purple-50 text-purple-700 border-purple-200">
                Growth Opportunities
              </Badge>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Company Values Section */}
      <section className="py-16 px-4 bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Work With Us?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We're more than just a platform – we're a community dedicated to transforming education 
              and empowering the next generation of innovators.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {companyValues.map((value, index) => {
              const IconComponent = iconMap[value.icon as keyof typeof iconMap];
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="text-center p-6 rounded-lg bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                    <IconComponent className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {value.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Positions Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Open Positions
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover opportunities to make a meaningful impact while growing your career 
              in the exciting intersection of education and technology.
            </p>
          </motion.div>

          {activeJobs.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
              {activeJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                >
                  <JobCard job={job} />
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Open Positions Right Now
              </h3>
              <p className="text-gray-600 mb-4">
                We're not actively hiring at the moment, but we're always interested in connecting 
                with talented individuals who share our mission.
              </p>
              <p className="text-sm text-gray-500">
                Feel free to reach out at careers@mentormates.com to introduce yourself!
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Make an Impact?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join us in shaping the future of education and mentorship. 
              We'd love to hear from passionate individuals who want to make a difference.
            </p>
            <div className="space-y-2">
              <p className="text-lg">
                👉 Interested? Reach out to us with a short note about yourself 
                and why you'd be excited to take on a role with us.
              </p>
              <p className="text-blue-100">
                careers@mentormates.com
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}