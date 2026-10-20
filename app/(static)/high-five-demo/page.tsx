import type { Metadata } from "next";
import Link from "next/link";
import { HighFiveDemo } from "@/features/mentorship/high-five/HighFiveDemo";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "High-Five Demo | MentorMates",
  description:
    "Interactive prototype of MentorMates' signature mentorship connection — raise a hand, high-five to connect, fist-bump to close.",
  robots: { index: false },
};

export default function HighFiveDemoPage() {
  return (
    <section className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-blue-50/40">
      <header className="px-5 pt-6 pb-2 max-w-4xl mx-auto w-full flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← MentorMates
        </Link>
        <span className="text-xs font-mono text-gray-400">/high-five-demo</span>
      </header>

      <main className="flex-1 px-5 py-10 md:py-14">
        <HighFiveDemo />
      </main>
      <Footer />
    </section>
  );
}
