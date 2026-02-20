"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventDetails, EventScoringConfig } from "@/lib/types";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";

// Import component tabs
import { TracksTab } from "./TracksTab";
import { PrizesTab } from "./PrizesTab";
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
  const [activeSubTab, setActiveSubTab] = useState("tracks");
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

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        {/* Sub tabs like Figma (simple pill switch) */}
        <TabsList className="inline-flex h-9 items-center justify-center rounded-full bg-white p-1 ring-1 ring-black/10">
            <TabsTrigger
              value="tracks"
            className="rounded-full px-3.5 text-xs sm:text-sm data-[state=active]:bg-gray-100 data-[state=active]:shadow-none"
            >
              Tracks &amp; scoring
            </TabsTrigger>
            <TabsTrigger
              value="prizes"
            className="rounded-full px-3.5 text-xs sm:text-sm data-[state=active]:bg-gray-100 data-[state=active]:shadow-none"
            >
              Prizes
            </TabsTrigger>
          </TabsList>

        {/* Tracks */}
        <TabsContent value="tracks" className="mt-4">
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
        </TabsContent>

        {/* Prizes */}
        <TabsContent value="prizes" className="mt-4">
          <PrizesTab
            event={event}
            setEvent={setEvent}
            saving={saving}
            setSaving={setSaving}
            toast={toast}
            isArchived={isArchived}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
} 