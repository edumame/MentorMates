import type { Metadata } from "next";
import { Modules } from "@/components/modules/Modules";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Modules — MentorMates",
  description:
    "MentorMates is a list of modules a founder community can turn on: events and hackathons, demo day, applications with feedback, jobs, co-founder matching, forum, and directory.",
  alternates: { canonical: "https://www.mentormates.ai/modules" },
  openGraph: {
    title: "MentorMates is a list of modules",
    description:
      "Events, demo day, applications, jobs, co-founders, forum and directory. Turn on the ones your community needs.",
    url: "https://www.mentormates.ai/modules",
  },
};

export default function ModulesPage() {
  return (
    <>
      <Modules />
      <Footer />
    </>
  );
}
