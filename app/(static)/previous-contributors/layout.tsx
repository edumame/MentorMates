import type { Metadata } from "next";
import type { ReactNode } from "react";

// Distinct page title/description (PUB-017); the page itself may be a client component.
export const metadata: Metadata = {
  title: "Previous Contributors | MentorMates",
  description: "People who have contributed to MentorMates.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
