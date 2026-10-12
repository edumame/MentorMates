"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventDetails, EventScoringConfig } from "@/lib/types";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";

// Import component tabs
import { TracksTab } from "./TracksTab";
import { PrizesTab } from "./PrizesTab";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

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
    <div className="w-full min-w-0">
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
      
      {/* Help banner explaining tracks, criteria, and weights */}
      <div className="mb-4">
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900">
            How tracks and scoring work
          </AlertTitle>
          <AlertDescription className="text-blue-800 space-y-1">
            <p>
              <strong>Tracks</strong> are categories that participants submit
              projects to (e.g., &quot;Best AI Project&quot;, &quot;Best
              Design&quot;). Each track has its own{" "}
              <strong>scoring criteria</strong>.
            </p>
            <p>
              <strong>Criteria</strong> are what judges score within a track
              (e.g., Technical Execution, Creativity). Each criterion has a{" "}
              <strong>weight</strong> — a number that determines how much it
              contributes to the final score. Weights are automatically
              normalized, so they don&apos;t need to sum to exactly 100%.
            </p>
          </AlertDescription>
        </Alert>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full min-w-0">
        <div className="scroll-x-tabs no-scrollbar w-full min-w-0 mb-6">
          <TabsList className="flex h-auto w-max flex-nowrap gap-2 p-0 justify-start bg-transparent border-0 shadow-none rounded-none">
          <TabsTrigger
            value="tracks"
            className="flex flex-shrink-0 items-center justify-center whitespace-nowrap px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
          >
            Tracks &amp; scoring
          </TabsTrigger>
          <TabsTrigger
            value="prizes"
            className="flex flex-shrink-0 items-center justify-center whitespace-nowrap px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
          >
            Prizes
          </TabsTrigger>
        </TabsList>
        </div>

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
