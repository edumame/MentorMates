"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle, Mail, Twitter, Linkedin, Github, BookOpen, FileQuestion, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SocialItem {
  label: string;
  url: string;
  icon: React.ReactNode;
}

interface DocItem {
  label: string;
  href: string;
  description: string;
  icon: React.ReactNode;
  isExternal?: boolean;
}

const socials: SocialItem[] = [
  {
    label: "Twitter",
    url: "https://twitter.com/mentormates",
    icon: <Twitter className="h-4 w-4" />,
  },
  {
    label: "LinkedIn",
    url: "https://linkedin.com/company/mentormates",
    icon: <Linkedin className="h-4 w-4" />,
  },
  {
    label: "GitHub",
    url: "https://github.com/mentormates",
    icon: <Github className="h-4 w-4" />,
  },
];

const docs: DocItem[] = [
  {
    label: "Research & Documentation",
    href: "/research",
    description: "Learn about our research and methodology",
    icon: <BookOpen className="h-4 w-4" />,
    isExternal: false,
  },
  {
    label: "FAQ",
    href: "/faq",
    description: "Frequently asked questions",
    icon: <FileQuestion className="h-4 w-4" />,
    isExternal: false,
  },
];

export function FloatingSupportButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "fixed bottom-4 right-4 z-40 md:bottom-6 md:right-6",
            "flex items-center gap-2 px-4 py-2.5 rounded-full",
            "bg-[#4B89EF] text-white font-medium text-sm",
            "shadow-lg hover:bg-[#3E7EEA] transition-all duration-200",
            "hover:shadow-xl hover:scale-105",
            "focus:outline-none focus:ring-2 focus:ring-[#4B89EF] focus:ring-offset-2",
            "[box-shadow:0_4px_14px_0_rgba(75,137,239,0.39)]"
          )}
          aria-label="Support"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Support</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        className="w-80 p-0 rounded-xl shadow-xl border-0 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4B89EF] to-[#6B9FEF] px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-semibold">How can we help?</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Contact Us Section */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Contact Us
            </h4>
            <a
              href="mailto:contact@outreach.mentormates.ai"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-[#4B89EF] group-hover:bg-blue-100 transition-colors">
                <Mail className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Mentor Mates</p>
                <p className="text-xs text-gray-500 truncate">contact@outreach.mentormates.ai</p>
              </div>
            </a>
          </section>

          {/* Follow Us Section */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Follow Us
            </h4>
            <div className="flex gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 text-gray-600 hover:bg-[#4B89EF] hover:text-white transition-all duration-200"
                  aria-label={social.label}
                  title={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </section>

          {/* Documentation Section */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Documentation & Resources
            </h4>
            <div className="space-y-1">
              {docs.map((doc) => (
                <Link
                  key={doc.label}
                  href={doc.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-600 group-hover:bg-green-100 transition-colors">
                    {doc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {doc.label}
                    </p>
                    <p className="text-xs text-gray-500">{doc.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
