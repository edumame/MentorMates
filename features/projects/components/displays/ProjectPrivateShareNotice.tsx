import { Lock } from "lucide-react";

/** Shown in the Sharing tab of both project-detail routes for private projects (MENT-016). */
export function ProjectPrivateShareNotice({ eventName }: { eventName?: string | null }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        This project is private. Only members of {eventName || "its event"} can
        open this link or QR code; anyone else will see &quot;Project not found&quot;.
      </p>
    </div>
  );
}
