"use client";

import { EventDetails, EventScoringConfig } from "@/lib/types";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { TracksTab } from "./TracksTab";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface EventTracksContainerProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  scoringConfig: EventScoringConfig | null;
  setScoringConfig: React.Dispatch<React.SetStateAction<EventScoringConfig | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: (props: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void;
}

export function EventTracksContainer({
  eventId,
  event,
  setEvent,
  scoringConfig,
  setScoringConfig,
  saving,
  setSaving,
  toast,
}: EventTracksContainerProps) {
  const { isArchived } = useEventArchiveStatus(event);

  return (
    <div className="w-full">
      {isArchived && (
        <div className="mb-4">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
            <AlertDescription>
              This event is archived and cannot be edited. To make changes, you
              must first unarchive the event using the controls below.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <TracksTab
        eventId={eventId}
        event={event}
        setEvent={setEvent}
        scoringConfig={scoringConfig}
        setScoringConfig={setScoringConfig}
        saving={saving}
        setSaving={setSaving}
        toast={toast}
        isArchived={isArchived}
      />
    </div>
  );
}
