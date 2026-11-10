import type { Metadata } from "next";
import type { ReactNode } from "react";

// Distinct page title/description (PUB-017); the page itself may be a client component.
export const metadata: Metadata = {
  title: "Host a Hackathon | MentorMates",
  description: "Run your hackathon with mentors, judging and feedback on MentorMates.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
