"use client";

import { useCallback, useRef, useState } from "react";

interface DraftCreationOptions {
  eventId?: string;
  leadName: string;
  leadEmail: string;
  contextus: boolean;
  onCreated?: (contextusId?: string) => void;
}

export function useProjectDraftCreation(options: DraftCreationOptions) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const createdId = useRef<string | null>(null);
  const pending = useRef<Promise<string> | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const ensureProjectId = useCallback(async (): Promise<string> => {
    if (createdId.current) return createdId.current;
    if (pending.current) return pending.current;

    const request = (async () => {
      const { onCreated, ...payload } = latest.current;
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to create draft. Please try saving again.");
      if (typeof json.id !== "string" || !json.id) throw new Error("Draft creation returned no project ID. Please try saving again.");
      createdId.current = json.id;
      setProjectId(json.id);
      onCreated?.(json.contextus_project_id);
      return json.id as string;
    })();
    pending.current = request;
    try {
      return await request;
    } finally {
      pending.current = null;
    }
  }, []);

  return { projectId, ensureProjectId };
}
