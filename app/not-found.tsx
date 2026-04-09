import Link from "next/link";
import { ArrowLeft, Compass, FolderOpen, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#EEF2FF] px-4 py-10">
      <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[#C9D9FF] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-[#D9E4FF] blur-3xl" />

      <section className="relative w-full max-w-2xl rounded-3xl border border-[#D9E3FF] bg-white/95 p-8 text-center shadow-[0_20px_50px_rgba(75,137,239,0.12)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#4B89EF]">
          <Compass className="h-8 w-8" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#4B89EF]">
          Error 404
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#181D27] sm:text-4xl">
          This page is missing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#535862] sm:text-base">
          The link may be outdated, or this section requires an account to view
          full project details.
        </p>

        <div className="mt-7 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="hostPrimary" asChild>
              <Link href="/login">
                <LogIn className="h-4 w-4 mr-2" />
                Log in
              </Link>
            </Button>
            <Button variant="hostGhost" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go home
              </Link>
            </Button>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-[#4B89EF] hover:underline"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Browse projects
          </Link>
        </div>
      </section>
    </main>
  );
}
