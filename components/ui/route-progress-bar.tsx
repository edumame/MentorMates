"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global route progress bar that shows at the bottom of the screen
 * during route transitions. Automatically tracks navigation changes.
 * 
 * This provides a visual loading indicator for route changes, which cannot
 * use React's useTransition since navigation is handled by Next.js router.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start progress animation when route changes
    setIsNavigating(true);
    setProgress(50);

    // Simulate progressive loading with multiple steps
    const progressSteps = [
      { delay: 0, value: 50 },      // Start at 50%
      { delay: 100, value: 70 },    // Mid progress
      { delay: 200, value: 90 },    // Almost done
      { delay: 300, value: 100 },   // Complete
    ];

    const timers = progressSteps.map(({ delay, value }) =>
      setTimeout(() => setProgress(value), delay)
    );

    // Hide progress bar after animation completes
    const hideTimer = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 400);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(hideTimer);
    };
  }, [pathname, searchParams]);

  return (
    <div
      className="fixed bottom-0 left-0 h-1 bg-blue-500 z-50 transition-all ease-out"
      style={{
        width: `${progress}%`,
        opacity: isNavigating ? 1 : 0,
        transitionDuration: progress === 100 ? "100ms" : "150ms",
      }}
    />
  );
}

