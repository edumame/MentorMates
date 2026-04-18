"use client";

import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function NotFound() {
  const handleGoHome = () => {
    window.location.href = "/";
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-b from-white to-sky-50 px-4">
      <div className="max-w-lg mx-auto text-center">
        <div className="mb-6">
          <Image
            alt="MentorMates"
            src="/mentormate.png"
            width={256}
            height={256}
            className="mx-auto object-contain"
          />
        </div>

        <h1 className="text-6xl font-bold text-slate-900 tracking-tight">
          404
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          This page doesn&apos;t exist or may have been moved.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Check the URL or head back to find what you&apos;re looking for.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button onClick={handleGoHome} className="gap-2">
            <Search className="h-4 w-4" />
            Browse events
          </Button>
        </div>
      </div>
    </div>
  );
}