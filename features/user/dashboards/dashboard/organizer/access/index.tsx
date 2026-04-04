"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordTab } from "./PasswordTab";
import { RoleLabelsTab } from "./RoleLabelsTab";
import { InviteJudgesTab } from "./InviteJudgesTab";
import { InviteOrganizersTab } from "./InviteOrganizersTab";
import { AssignTab } from "../assign";
import { EventDetails } from "@/lib/types";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ACCESS_SUBTAB_VALUES = [
  "password",
  "role-labels",
  "invite-judges",
  "invite-organizers",
  "assign-roles",
] as const;
export type AccessSubTab = (typeof ACCESS_SUBTAB_VALUES)[number];

const ACCESS_SUBTAB_LABELS: Record<AccessSubTab, string> = {
  password: "Password",
  "role-labels": "Role Labels",
  "invite-judges": "Invite Judges",
  "invite-organizers": "Invite Organizers",
  "assign-roles": "Assign Roles",
};

interface AccessTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  activeSubTab?: AccessSubTab;
}

export function AccessTab({
  eventId,
  event,
  setEvent,
  saving,
  setSaving,
  activeSubTab: initialSubTab = "password",
}: AccessTabProps) {
  const { isArchived } = useEventArchiveStatus(event);
  const [activeSubTab, setActiveSubTab] = useState<AccessSubTab>(initialSubTab);

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="p-0 pb-4">
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
        <Tabs
          value={activeSubTab}
          onValueChange={(v) => setActiveSubTab(v as AccessSubTab)}
        >
          <TabsList className="flex h-auto gap-2 p-0 justify-start bg-transparent border-0 shadow-none rounded-none flex-wrap">
            {ACCESS_SUBTAB_VALUES.map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center justify-center px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
              >
                {ACCESS_SUBTAB_LABELS[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        {activeSubTab === "password" && (
          <PasswordTab
            eventId={eventId}
            roleLabels={event.role_labels}
            isArchived={isArchived}
            event={event}
            setEvent={setEvent}
          />
        )}
        {activeSubTab === "role-labels" && (
          <RoleLabelsTab
            eventId={eventId}
            event={event}
            setEvent={setEvent}
            saving={saving}
            setSaving={setSaving}
            isArchived={isArchived}
          />
        )}
        {activeSubTab === "invite-judges" && (
          <InviteJudgesTab eventId={eventId} isArchived={isArchived} />
        )}
        {activeSubTab === "invite-organizers" && (
          <InviteOrganizersTab eventId={eventId} isArchived={isArchived} />
        )}
        {activeSubTab === "assign-roles" && (
          <AssignTab eventId={eventId} />
        )}
      </CardContent>
    </Card>
  );
}
