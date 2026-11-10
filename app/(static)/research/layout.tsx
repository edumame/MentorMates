import type { Metadata } from "next";
import type { ReactNode } from "react";

// Distinct page title/description (PUB-017); the page itself may be a client component.
export const metadata: Metadata = {
  title: "Research | MentorMates",
  description: "Research behind MentorMates.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
