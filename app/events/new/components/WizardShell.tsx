"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText,
  ClipboardList,
  Trophy,
  Mail,
  Link2,
  Check,
} from "lucide-react";
import type { WizardEventData } from "@/lib/types/wizard";
import { applyScrapedData } from "@/lib/types/wizard";
import { extractScrapedImportPayload } from "./scrape-import";

const STEPS = [
  { id: 0, name: "Details", icon: FileText },
  { id: 1, name: "Submission", icon: ClipboardList },
  { id: 2, name: "Judging", icon: Trophy },
  { id: 3, name: "Invite", icon: Mail },
] as const;

interface WizardShellProps {
  event: WizardEventData;
  setEvent: React.Dispatch<React.SetStateAction<WizardEventData>>;
  children: (step: number) => React.ReactNode;
}

export function WizardShell({ event, setEvent, children }: WizardShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scraped, setScraped] = useState(false);

  // Scroll to top when switching steps
  useEffect(() => {
    contentRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [currentStep]);

  const doScrape = useCallback(
    async (url: string) => {
      if (!url.trim()) return;
      setScraping(true);
      setScrapeError(null);
      setScraped(false);

      try {
        const res = await fetch("/api/events/import/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), browserProfile: "lite" }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "Failed to scrape"
          );
        }

        const result = extractScrapedImportPayload(data);
        setEvent((prev) => applyScrapedData(result, prev));
        setScraped(true);
      } catch (err) {
        setScrapeError(
          err instanceof Error ? err.message : "Network error"
        );
      } finally {
        setScraping(false);
      }
    },
    [setEvent]
  );

  // Auto-scrape if ?url= param is present
  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setScrapeUrl(urlParam);
      doScrape(urlParam);
    }
  }, [searchParams, doScrape]);

  function handleScrapeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (scrapeUrl.trim()) {
      const params = new URLSearchParams();
      params.set("url", scrapeUrl.trim());
      router.replace(`/events/new?${params.toString()}`);
      doScrape(scrapeUrl.trim());
    }
  }

  return (
    <div>
      {/* URL Import Bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-4">
          <form
            onSubmit={handleScrapeSubmit}
            className="flex items-center gap-2 sm:gap-3"
          >
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                disabled={scraping}
                placeholder="Paste a hackathon URL to auto-fill..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={scraping || !scrapeUrl.trim()}
              className="shrink-0 rounded-xl bg-[#4B89EF] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3E7EEA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {scraping ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="size-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Scraping...
                </span>
              ) : (
                "Import"
              )}
            </button>
          </form>

          {scraping && (
            <p className="mt-2 text-sm text-[#4B89EF]">
              Scraping in progress — this can take 1-3 minutes...
            </p>
          )}
          {scrapeError && (
            <p className="mt-2 text-sm text-red-600">{scrapeError}</p>
          )}
          {scraped && !scraping && (
            <p className="mt-2 text-sm text-green-600">
              Data imported successfully. Review and edit below.
            </p>
          )}
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-6 sm:pt-6">
        <nav aria-label="Breadcrumb" className="flex">
          <ol
            role="list"
            className="flex w-full rounded-xl bg-white px-2 shadow-sm ring-1 ring-gray-200 sm:px-6"
          >
            {STEPS.map((step, index) => {
              const isComplete = step.id < currentStep;
              const isCurrent = step.id === currentStep;
              const Icon = step.icon;
              return (
                <li key={step.name} className="flex flex-1">
                  <div className="flex flex-1 items-center">
                    {index > 0 && (
                      <svg
                        fill="currentColor"
                        viewBox="0 0 24 44"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className="hidden h-full w-6 shrink-0 text-gray-200 sm:block"
                      >
                        <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
                      </svg>
                    )}
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors sm:flex-row sm:gap-2 sm:py-4 sm:text-sm ${
                        isCurrent
                          ? "text-[#4B89EF]"
                          : isComplete
                            ? "text-gray-700 hover:text-gray-900"
                            : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {isComplete ? (
                        <Check className="size-4 text-blue-600" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                      <span className="hidden sm:inline">
                        Step {step.id + 1}:
                      </span>
                      <span className="leading-tight">{step.name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Page Content */}
      <div
        ref={contentRef}
        className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8"
      >
        {children(currentStep)}

        {/* Step Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <button
            onClick={() =>
              setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))
            }
            disabled={currentStep === STEPS.length - 1}
            className="rounded-lg bg-[#4B89EF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#3E7EEA] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
