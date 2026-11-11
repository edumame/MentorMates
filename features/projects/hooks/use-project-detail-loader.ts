"use client";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";

/** Shared loading lifecycle for both project detail routes, including retry and stale-response protection. */
export function useProjectDetailLoader(projectId: string, onProject: (project: Project | null) => void, enabled = true, access: "authenticated" | "public" = "authenticated") {
  const callback = useRef(onProject);
  callback.current = onProject;
  const [isLoading, setIsLoading] = useState(true);
  const [fetchComplete, setFetchComplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) {
      callback.current(null);
      setIsLoading(false); setFetchComplete(true); setLoadError(null);
      return;
    }
    const controller = new AbortController();
    let current = true;
    setIsLoading(true); setFetchComplete(false); setLoadError(null);
    callback.current(null);
    void (async () => {
      try {
        const response = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}${access === "public" ? "&public=true" : ""}`, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!current) return;
        if (!response.ok && ![401, 403, 404].includes(response.status)) throw new Error("Unable to load project. Please try again.");
        if (response.ok && !payload?.project) throw new Error("Invalid project response");
        callback.current(response.ok ? payload.project : null);
      } catch {
        if (current) setLoadError("Unable to load project. Please try again.");
      } finally {
        if (current) { setIsLoading(false); setFetchComplete(true); }
      }
    })();
    return () => { current = false; controller.abort(); };
  }, [projectId, enabled, access, attempt]);
  return { isLoading, fetchComplete, loadError, retryProject: () => setAttempt(value => value + 1) };
}
