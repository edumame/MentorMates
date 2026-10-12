import type { Metadata } from "next";

const SITE_URL = "https://www.mentormates.ai";
const SITE_NAME = "MentorMates";
const TITLE = "MentorMates — Hackathon Mentorship Platform for Students & Mentors";
const DESCRIPTION =
  "MentorMates is the all-in-one platform connecting mentors and students at hackathons, design days, and innovation events. Get real-time feedback and build better.";
const OG_IMAGE = "/mentormate.png";

export const seoMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/mentormate.png",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "MentorMates — Hackathon Mentorship Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};
