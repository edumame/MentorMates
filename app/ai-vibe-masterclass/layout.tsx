import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Vibe Coding Masterclass | MentorMates",
  description:
    "A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.",
};

export default function AIVibeMasterclassLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}