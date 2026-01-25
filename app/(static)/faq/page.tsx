"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, HelpCircle, Mail, Play, ArrowRight } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

interface TutorialVideo {
  title: string;
  description: string;
  href: string;
}

const tutorials: TutorialVideo[] = [
  {
    title: "Participant",
    description: "Submit projects, share ideas, and get real feedback from mentors and judges.",
    href: "https://youtu.be/GMHO4vdLgD0",
  },
  {
    title: "Mentor",
    description: "Support participants with actionable, encouraging feedback that helps them grow.",
    href: "https://youtu.be/mAm-LnMK5dA",
  },
  {
    title: "Judge",
    description: "Review projects, score fairly, and provide constructive feedback.",
    href: "https://youtu.be/o1iCt7qE5UY",
  },
  {
    title: "Organizer",
    description: "Manage events: set up submissions, assign mentors/judges, and configure parameters.",
    href: "https://youtu.be/DFGjGusKtdo",
  },
];

const faqs: FAQItem[] = [
  {
    question: "What is MentorMates?",
    answer:
      "MentorMates is a platform designed to connect hackathon participants with mentors and judges. It streamlines the feedback process, making it easier for participants to get actionable guidance and for mentors to provide meaningful support during hackathon events.",
  },
  {
    question: "How do I join an event as a participant?",
    answer:
      "To join an event, you'll need an invitation link from the event organizer or you can browse public events on the Events page. Once you find an event, click 'Join' and select your role as a participant. You may need to complete a brief registration process depending on the event settings.",
  },
  {
    question: "How do I submit a project?",
    answer:
      "After joining an event as a participant, navigate to the event dashboard and click 'Submit Project'. You'll be prompted to enter your project details including name, description, team members, and any relevant links (GitHub, demo, etc.). Make sure to submit before the event deadline.",
  },
  {
    question: "What roles are available on MentorMates?",
    answer:
      "MentorMates supports four main roles: Participants (who submit projects), Mentors (who provide feedback and guidance), Judges (who evaluate and score projects), and Organizers (who manage the event). Each role has specific permissions and dashboards tailored to their needs.",
  },
  {
    question: "How does the feedback system work?",
    answer:
      "Mentors and judges can provide feedback on submitted projects through the project page. Feedback can include written comments, scores based on rubrics set by organizers, and actionable suggestions. Participants receive notifications when feedback is submitted and can view all feedback on their project dashboard.",
  },
  {
    question: "Can I be both a mentor and a judge?",
    answer:
      "Yes, depending on the event settings, you may hold multiple roles. However, to avoid conflicts of interest, you typically cannot judge projects you've mentored. Check with your event organizer for specific policies.",
  },
  {
    question: "How do I become a mentor or judge?",
    answer:
      "Event organizers can invite you to be a mentor or judge using your email address. You'll receive an invitation link to accept the role. Some events may also have an application process for mentors and judges.",
  },
  {
    question: "Is MentorMates free to use?",
    answer:
      "MentorMates offers free features for participants and basic event management. Some advanced features for organizers may require a subscription. Check our pricing page for more details.",
  },
  {
    question: "How do I create my own hackathon event?",
    answer:
      "To create an event, log in and navigate to 'Events' then click 'Create Event'. You'll be guided through setting up your event details, submission requirements, judging criteria, and team roles. You can customize various aspects including rubrics, deadlines, and participant limits.",
  },
  {
    question: "What should I do if I encounter a bug or issue?",
    answer:
      "If you encounter any issues, please contact us at contact@outreach.mentormates.ai with a description of the problem, including screenshots if possible. We're committed to resolving issues quickly to ensure a smooth experience.",
  },
  {
    question: "How can I provide feedback about the platform?",
    answer:
      "We love hearing from our users! You can send feedback to contact@outreach.mentormates.ai or reach out through our social media channels. Your suggestions help us improve MentorMates for everyone.",
  },
  {
    question: "Where can I learn more about using MentorMates?",
    answer:
      "Check out our Help page for video guides on each role, or visit our Research page to learn about the methodology behind our platform. You can also explore our documentation for detailed feature explanations.",
  },
];

function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors px-4 -mx-4 rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="text-base font-medium text-gray-900 pr-4">
          {item.question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-gray-500 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-96 pb-5" : "max-h-0"
        )}
      >
        <p className="text-gray-600 leading-relaxed">{item.answer}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <>
      <div className="min-h-screen py-2">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-10 pt-16 pb-16">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-900">
              <HelpCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Support</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              Frequently Asked{" "}
              <span className="text-blue-900">Questions</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-700">
              Find answers to common questions about MentorMates. Can&apos;t find
              what you&apos;re looking for? Contact us directly.
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
            {faqs.map((faq, index) => (
              <FAQAccordionItem
                key={index}
                item={faq}
                isOpen={openIndex === index}
                onToggle={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
              />
            ))}
          </div>

          {/* Video Tutorials Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 text-center">
              Video Tutorials
            </h2>
            <p className="text-gray-600 text-center">
              Watch quick guides on how to use MentorMates for each role.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {tutorials.map((tutorial) => (
                <Link
                  key={tutorial.title}
                  href={tutorial.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-xl bg-white p-5 shadow-lg transition-all hover:shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">
                        {tutorial.title}
                      </h3>
                      <p className="mt-1 text-gray-600 text-sm leading-relaxed">
                        {tutorial.description}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-blue-50 p-2.5 text-blue-900 transition-transform group-hover:translate-x-1">
                      <Play className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center text-blue-900 font-medium text-sm">
                    Watch guide
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Contact CTA */}
          <div className="bg-gradient-to-r from-[#4B89EF] to-[#6B9FEF] rounded-xl p-6 sm:p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-2">Still have questions?</h2>
            <p className="text-white/90 mb-4">
              We&apos;re here to help. Reach out to us directly.
            </p>
            <a
              href="mailto:contact@outreach.mentormates.ai"
              className="inline-flex items-center gap-2 bg-white text-[#4B89EF] px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              <Mail className="h-5 w-5" />
              Contact Us
            </a>
          </div>

          {/* Related Links */}
          <div className="text-center space-y-4">
            <p className="text-gray-600">Looking for more resources?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/help"
                className="text-blue-900 underline hover:text-blue-700 font-medium"
              >
                Role Guides
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/research"
                className="text-blue-900 underline hover:text-blue-700 font-medium"
              >
                Our Research
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/about"
                className="text-blue-900 underline hover:text-blue-700 font-medium"
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
}
