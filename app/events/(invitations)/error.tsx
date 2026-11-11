"use client";

import { Button } from "@/components/ui/button";

export default function InvitationError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Unable to load invitation</h1>
      <p className="text-muted-foreground">
        Something went wrong while loading your invitation. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
