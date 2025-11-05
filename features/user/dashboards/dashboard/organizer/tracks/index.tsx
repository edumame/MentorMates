"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Tracks & Prizes</CardTitle>
        {isArchived && (
          <div className="mt-2 py-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
              <AlertDescription>This event is archived and cannot be edited. To make changes, you must first unarchive the event using the controls below.</AlertDescription>
            </Alert>
          </div>
        )}
      </CardHeader>
      <CardContent>
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger value="tracks">Tracks & Scoring</TabsTrigger>
            <TabsTrigger value="prizes">Prizes</TabsTrigger>
          </TabsList>

          {/* Tracks */}
          <TabsContent value="tracks">
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
          <TabsContent value="prizes">
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
      </CardContent>
    </Card>
  );
} 