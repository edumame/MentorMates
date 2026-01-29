"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordTab } from "./PasswordTab";
import { RoleLabelsTab } from "./RoleLabelsTab";
import { InviteOrganizersTab } from "./InviteOrganizersTab";
import { EventDetails } from "@/lib/types";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AccessTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
}

export function AccessTab({
  eventId,
  event,
  setEvent,
  saving,
  setSaving,
}: AccessTabProps) {
  const [activeTab, setActiveTab] = useState("password");
  const { isArchived } = useEventArchiveStatus(event);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Controls</CardTitle>
        {isArchived && (
          <div className="mt-2 py-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTitle className="text-orange-900">
                ⚠️ Event is Archived
              </AlertTitle>
              <AlertDescription>
                This event is archived and cannot be edited. To make changes,
                you must first unarchive the event using the controls below.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="role-labels">Role Labels</TabsTrigger>
            <TabsTrigger value="invite-organizers">
              Invite Organizers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-6">
            <PasswordTab
              eventId={eventId}
              roleLabels={event.role_labels}
              isArchived={isArchived}
              event={event}
              setEvent={setEvent}
            />
          </TabsContent>

          <TabsContent value="role-labels" className="mt-6">
            <RoleLabelsTab
              eventId={eventId}
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
              isArchived={isArchived}
            />
          </TabsContent>

          <TabsContent value="invite-organizers" className="mt-6">
            <InviteOrganizersTab eventId={eventId} isArchived={isArchived} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
