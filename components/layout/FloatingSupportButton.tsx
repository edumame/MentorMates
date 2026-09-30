"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Mail, Linkedin, BookOpen, FileQuestion, X, Instagram, Bug, PlayCircle } from "lucide-react";

// Custom Discord icon since lucide-react doesn't have one
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Custom X (Twitter) icon
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BugReportDialog } from "@/components/layout/BugReportDialog";

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
    label: "Instagram",
    url: "https://www.instagram.com/mentormates.official/",
    icon: <Instagram className="h-4 w-4" />,
  },
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/mentormates/",
    icon: <Linkedin className="h-4 w-4" />,
  },
  {
    label: "X",
    url: "https://x.com/mentormates",
    icon: <XIcon className="h-4 w-4" />,
  },
  {
    label: "Discord",
    url: "https://discord.gg/vNmsgBRscp",
    icon: <DiscordIcon className="h-4 w-4" />,
  },
];

const docs: DocItem[] = [
  {
    label: "FAQ",
    href: "/faq",
    description: "Frequently asked questions",
    icon: <FileQuestion className="h-4 w-4" />,
    isExternal: false,
  },
  {
    label: "Role Guides",
    href: "/help",
    description: "Video tutorials for each role",
    icon: <PlayCircle className="h-4 w-4" />,
    isExternal: false,
  },
  {
    label: "Research",
    href: "/research",
    description: "Our methodology and studies",
    icon: <BookOpen className="h-4 w-4" />,
    isExternal: false,
  },
];

export function FloatingSupportButton() {
  const [open, setOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith("/chat");

  return (
    <>
    <BugReportDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "fixed right-4 z-40 md:right-6",
            isChatPage ? "bottom-28 md:bottom-32" : "bottom-4 md:bottom-6",
            "flex items-center justify-center w-12 h-12 rounded-full",
            "bg-[#4B89EF] text-white",
            "shadow-lg hover:bg-[#3E7EEA] transition-all duration-200",
            "hover:shadow-xl hover:scale-105",
            "focus:outline-none focus:ring-2 focus:ring-[#4B89EF] focus:ring-offset-2",
            "[box-shadow:0_4px_14px_0_rgba(75,137,239,0.39)]"
          )}
          aria-label="Support"
        >
          <HelpCircle className="h-6 w-6" />
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
            <div className="space-y-1">
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
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setReportOpen(true);
                }}
                className="flex w-full items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group text-left"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-500 group-hover:bg-red-100 transition-colors">
                  <Bug className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Report a Bug</p>
                  <p className="text-xs text-gray-500 truncate">Help us improve MentorMates</p>
                </div>
              </button>
            </div>
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
    </>
  );
}
