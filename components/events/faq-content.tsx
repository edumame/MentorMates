"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How do I register?",
    answer: "To register for the event, click the 'Join Event' button on the event overview page. You'll need to create an account or sign in if you haven't already. Once registered, you'll receive a confirmation email with all the details you need to participate.",
  },
  {
    question: "What are the requirements?",
    answer: "Participants should bring their own laptops and any necessary equipment. Basic programming knowledge is recommended but not required. We welcome participants of all skill levels, from beginners to experienced developers.",
  },
  {
    question: "How is judging done?",
    answer: "Projects are evaluated by a panel of experienced judges based on criteria including innovation, technical implementation, design, and presentation. Judges will review project submissions and provide feedback. Winners will be announced at the closing ceremony.",
  },
  {
    question: "Can I work alone or do I need a team?",
    answer: "Both solo participants and teams are welcome! Teams can have up to 4 members. You can form teams before the event or find teammates during the team formation session at the beginning of the hackathon.",
  },
  {
    question: "What should I bring?",
    answer: "Bring your laptop, charger, any hardware you plan to use, and a valid ID. We'll provide meals, snacks, and beverages throughout the event. You may also want to bring a sleeping bag and pillow if it's an overnight event.",
  },
  {
    question: "Are meals provided?",
    answer: "Yes! We provide all meals, snacks, and beverages throughout the event. Vegetarian, vegan, and other dietary restrictions can be accommodated - just let us know when you register.",
  },
  {
    question: "What if I don't have a project idea?",
    answer: "No problem! Many participants come without ideas and develop them during the event. We'll have brainstorming sessions, and mentors will be available to help you explore ideas and find your passion project.",
  },
  {
    question: "Can I start working on my project before the event?",
    answer: "No, all work on projects must begin after the official event start time. However, you can come with ideas, plan your approach, and bring any tools or resources you'll need.",
  },
];

export function FAQContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="flex flex-col flex-1 w-full">
      {/* FAQ List */}
      <div className="flex flex-col gap-0 w-full">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={`flex flex-col w-full py-6 ${
              index !== faqs.length - 1 ? "border-b border-[rgba(0,0,0,0.15)]" : ""
            }`}
          >
            {/* Question Row */}
            <button
              onClick={() => toggleAccordion(index)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="font-semibold text-[22px] leading-[1.4] tracking-[-0.06em] text-black">
                {faq.question}
              </h3>
              {openIndex === index ? (
                <ChevronUp className="w-6 h-6 text-black shrink-0" />
              ) : (
                <ChevronDown className="w-6 h-6 text-black shrink-0" />
              )}
            </button>

            {/* Answer (collapsible) */}
            {openIndex === index && (
              <div className="mt-4 max-w-[768px]">
                <p className="font-normal text-[16px] leading-[1.5] text-black">
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Still have questions section */}
      <div className="flex flex-col gap-4 items-start mt-12 pt-8 border-t border-[rgba(0,0,0,0.15)]">
        <h3 className="font-semibold text-[22px] leading-[1.4] tracking-[-0.06em] text-black">
          Still have questions?
        </h3>
        <p className="font-normal text-[16px] leading-[1.5] text-black max-w-[768px]">
          Can&apos;t find the answer you&apos;re looking for? Please reach out to our team and we&apos;ll get back to you as soon as possible.
        </p>
        <Button className="bg-[#4b89ef] text-white font-semibold text-[16px] leading-[1.5] px-6 py-3 rounded-xl shadow-sm hover:bg-[#3d75d9] transition-colors">
          Contact
        </Button>
      </div>
    </div>
  );
}
