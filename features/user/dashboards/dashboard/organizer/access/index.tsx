"use client";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { PasswordTab } from "./PasswordTab";
import { RoleLabelsTab } from "./RoleLabelsTab";
import { InviteJudgesTab } from "./InviteJudgesTab";
import { InviteOrganizersTab } from "./InviteOrganizersTab";
import { EventDetails } from "@/lib/types";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ACCESS_SUBTAB_VALUES = [
  "password",
  "role-labels",
  "invite-judges",
  "invite-organizers",
] as const;
export type AccessSubTab = (typeof ACCESS_SUBTAB_VALUES)[number];

interface AccessTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  activeSubTab: AccessSubTab;
}

export function AccessTab({
  eventId,
  event,
  setEvent,
  saving,
  setSaving,
  activeSubTab,
}: AccessTabProps) {
  const { isArchived } = useEventArchiveStatus(event);

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="p-0 pb-0">
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
      </CardContent>
    </Card>
  );
}
