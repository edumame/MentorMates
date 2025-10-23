"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventDetails } from "@/lib/types";
import { toast as useToast } from "@/lib/hooks/use-toast";

// Import component tabs
import { BasicInfoTab } from "./BasicInfoTab";
import { ScheduleTab } from "./ScheduleTab";
import { ResourcesTab } from "./ResourcesTab";
import { RulesTab } from "./RulesTab";
import { FAQTab } from "./FAQTab";
import { ContentTab } from "./ContentTab";

interface EventDetailsTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  router: ReturnType<typeof useRouter>;
  toast: typeof useToast;
  refetchEvent?: () => void;
  isArchived?: boolean;
}

export function EventDetailsTab({
  event,
  setEvent,
  saving,
  setSaving,
  router,
  toast,
  refetchEvent,
  isArchived = false,
}: EventDetailsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("basic-info");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList className="mb-4 w-full overflow-x-auto flex-nowrap sm:flex-wrap gap-2">
            <TabsTrigger value="basic-info" className="px-3 py-1.5 shrink-0 text-xs sm:text-sm">Basic Information</TabsTrigger>
            <TabsTrigger value="content" className="px-3 py-1.5 shrink-0 text-xs sm:text-sm">Content</TabsTrigger>
            <TabsTrigger value="schedule" className="px-3 py-1.5 shrink-0 text-xs sm:text-sm">Schedule</TabsTrigger>
            <TabsTrigger value="resources" className="px-3 py-1.5 shrink-0 text-xs sm:text-sm">Resources</TabsTrigger>
            <TabsTrigger value="rules" className="px-3 py-1.5 shrink-0 text-xs sm:text-sm">Rules</TabsTrigger>
            <TabsTrigger value="faq" className="px-3 py-1.5 shrink-0 text-xs sm:text-sm">FAQ</TabsTrigger>
          </TabsList>

          {/* Basic Information */}
          <TabsContent value="basic-info">
            <BasicInfoTab
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
              toast={toast}
              router={router}
            />
          </TabsContent>

          {/* Content */}
          <TabsContent value="content">
            <ContentTab
              event={event}
              setEvent={setEvent}
              refetchEvent={refetchEvent}
              isArchived={isArchived}
            />
          </TabsContent>

          {/* Schedule */}
          <TabsContent value="schedule">
            <ScheduleTab
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
              toast={toast}
            />
          </TabsContent>

          {/* Resources */}
          <TabsContent value="resources">
            <ResourcesTab
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
              toast={toast}
            />
          </TabsContent>

          {/* Rules */}
          <TabsContent value="rules">
            <RulesTab
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
              toast={toast}
            />
          </TabsContent>

          {/* FAQ */}
          <TabsContent value="faq">
            <FAQTab
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
              toast={toast}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
