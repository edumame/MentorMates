"use client";

import { Button } from "@/components/ui/button";

interface ProjectSaveStatusProps {
  isSaving: boolean;
  saveError: string | null;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  isSessionActive?: boolean;
  onRetry: () => Promise<boolean>;
}

export function ProjectSaveStatus({ isSaving, saveError, hasUnsavedChanges, lastSaved, isSessionActive = true, onRetry }: ProjectSaveStatusProps) {
  const message = !isSessionActive ? "Sign in again to save your changes"
    : isSaving ? "Saving draft…"
      : saveError ? `Draft not saved: ${saveError}`
        : hasUnsavedChanges ? "Changes are not saved yet" : "All changes saved";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <p role={saveError || !isSessionActive ? "alert" : "status"} className="text-[#4c4c4c] text-base font-medium tracking-[-0.06em]">{message}</p>
      {saveError && isSessionActive && <Button variant="outline" disabled={isSaving} onClick={() => { void onRetry(); }}>Retry save</Button>}
      {lastSaved && !hasUnsavedChanges && !saveError && isSessionActive && !isSaving && (
        <p className="text-[#7f7f7f] text-sm font-medium">Saved at {lastSaved.toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
      )}
    </div>
  );
}
