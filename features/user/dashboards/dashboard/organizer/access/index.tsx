"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordTab } from "./PasswordTab";
import { RoleLabelsTab } from "./RoleLabelsTab";
import { InviteOrganizersTab } from "./InviteOrganizersTab";
import { EventManagementTab } from "./EventManagementTab";
import { EventDetails } from "@/lib/types";

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
  const [activeTab, setActiveTab] = useState("management");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid-cols-4">
            <TabsTrigger value="management">Management</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="role-labels">Role Labels</TabsTrigger>
            <TabsTrigger value="invite-organizers">
              Invite Organizers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="management" className="mt-6">
            <EventManagementTab
              event={event}
              setEvent={setEvent}
            />
          </TabsContent>

          <TabsContent value="password" className="mt-6">
            <PasswordTab eventId={eventId} roleLabels={event.role_labels} />
          </TabsContent>

          <TabsContent value="role-labels" className="mt-6">
            <RoleLabelsTab
              eventId={eventId}
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
            />
          </TabsContent>

          <TabsContent value="invite-organizers" className="mt-6">
            <InviteOrganizersTab eventId={eventId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
