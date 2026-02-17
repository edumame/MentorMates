"use client";

import { DependencyList, useEffect, useRef } from "react";

export function useDebouncedEffect(
  callback: () => void,
  dependencies: DependencyList,
  delayMs: number,
  enabled = true
) {
  const latestCallback = useRef(callback);

  useEffect(() => {
    latestCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(() => {
      latestCallback.current();
    }, delayMs);

    return () => window.clearTimeout(timer);
    // This hook accepts a variable dependency list by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs, enabled, ...dependencies]);
}
