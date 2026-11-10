import type { Metadata } from "next";
import type { ReactNode } from "react";

// Distinct page title/description (PUB-017); the page itself may be a client component.
export const metadata: Metadata = {
  title: "About | MentorMates",
  description: "Learn about MentorMates, the hackathon mentorship platform for students and mentors.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
