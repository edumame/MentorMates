"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Archive, ArchiveRestore, Eye, EyeOff, Globe, Lock, FileText } from "lucide-react";
import { EventDetails, EventVisibility } from "@/lib/types";
import { ArchiveEventButton } from "@/components/events/archive-event-button";

interface EventManagementTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
}

export function EventManagementTab({ event, setEvent }: EventManagementTabProps) {
  const getVisibilityInfo = (visibility: EventVisibility) => {
    switch (visibility) {
      case EventVisibility.Public:
        return {
          icon: Globe,
          label: "Public",
          description: "Visible to everyone",
          color: "text-green-600",
          bgColor: "bg-green-100",
        };
      case EventVisibility.Private:
        return {
          icon: Lock,
          label: "Private",
          description: "Requires password to join",
          color: "text-blue-600",
          bgColor: "bg-blue-100",
        };
      case EventVisibility.Draft:
        return {
          icon: FileText,
          label: "Draft",
          description: "Only visible to organizers",
          color: "text-gray-600",
          bgColor: "bg-gray-100",
        };
      case EventVisibility.Archived:
        return {
          icon: Archive,
          label: "Archived",
          description: "Read-only, hidden from main list",
          color: "text-orange-600",
          bgColor: "bg-orange-100",
        };
      case EventVisibility.Test:
        return {
          icon: EyeOff,
          label: "Test",
          description: "Test mode",
          color: "text-purple-600",
          bgColor: "bg-purple-100",
        };
      case EventVisibility.Demo:
        return {
          icon: Eye,
          label: "Demo",
          description: "Demo mode",
          color: "text-indigo-600",
          bgColor: "bg-indigo-100",
        };
      default:
        return {
          icon: Globe,
          label: "Unknown",
          description: "Unknown visibility",
          color: "text-gray-600",
          bgColor: "bg-gray-100",
        };
    }
  };

  const visibilityInfo = getVisibilityInfo(event.visibility || EventVisibility.Draft);
  const VisibilityIcon = visibilityInfo.icon;

  const handleArchiveStatusChange = (newVisibility: EventVisibility) => {
    setEvent(prevEvent => prevEvent ? { ...prevEvent, visibility: newVisibility } : null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VisibilityIcon className="h-5 w-5" />
            Event Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${visibilityInfo.bgColor}`}>
              <VisibilityIcon className={`h-4 w-4 ${visibilityInfo.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{visibilityInfo.label}</span>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${visibilityInfo.bgColor} ${visibilityInfo.color}`}>
                  {event.visibility}
                </div>
              </div>
              <p className="text-sm text-gray-600">{visibilityInfo.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Archive Event</h4>
              <p className="text-sm text-gray-600 mb-4">
                {event.visibility === EventVisibility.Archived ? (
                  <>
                    This event is currently archived. It's in read-only mode and hidden from the main events list.
                    You can unarchive it to make it active again.
                  </>
                ) : (
                  <>
                    Archive this event to make it read-only and hide it from the main events list. 
                    Archived events can still be viewed but cannot be modified.
                  </>
                )}
              </p>
              
              <ArchiveEventButton
                eventId={event.event_id}
                eventName={event.event_name}
                currentVisibility={event.visibility || EventVisibility.Draft}
                onArchiveStatusChange={handleArchiveStatusChange}
                variant="outline"
                size="default"
              />
            </div>
            
            <div className="border-t border-gray-200 my-4"></div>
            
            <div>
              <h4 className="font-medium mb-2">Event Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Event ID:</span>
                  <span className="ml-2 font-mono">{event.event_id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Created:</span>
                  <span className="ml-2">{new Date(event.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Date:</span>
                  <span className="ml-2">{event.event_date}</span>
                </div>
                <div>
                  <span className="text-gray-600">Location:</span>
                  <span className="ml-2">{event.location || "Not specified"}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}